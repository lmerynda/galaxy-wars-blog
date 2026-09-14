import { content, revision, apiHelp } from "./api-help";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { JSONValue } from "postgres";
import { apiTokenValid } from "./auth";
import { db } from "./db";
import { createPost, ownerPost, savePost } from "./posts";
import { MAX_IMAGE_BYTES, uploadImage } from "./images";
import { errorDetails } from "./diagnostics";
import { InputError, type Post } from "../lib/post";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function result(post: Post) {
  return {
    post,
    editUrl: `/admin/posts/${post.id}/edit`,
    publicUrl: `/days/${post.publishedDay}#entry-${post.id}`,
  };
}
async function readBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

// All writes and their retry receipts commit together. Locks serialize concurrent retries.
export async function handleApi(request: Request, path: string[]) {
  const requestId = randomUUID();
  const started = Date.now();
  const respond = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match || !apiTokenValid(match[1]))
      throw new ApiError(401, "A valid API bearer token is required.");
    if (request.method === "GET" && path.length === 1 && path[0] === "help")
      return respond(apiHelp());
    const credential = { apiToken: match[1] };
    const [resource, id] = path;
    const uploading =
      request.method === "POST" && resource === "images" && path.length === 1;
    if (
      !uploading &&
      (resource !== "posts" ||
        path.length > 2 ||
        (id && !z.uuid().safeParse(id).success))
    )
      throw new ApiError(404, "Endpoint not found.");
    if (
      request.method === "GET" &&
      resource === "posts" &&
      id &&
      path.length === 2
    ) {
      const post = await ownerPost(id, credential);
      if (!post) throw new ApiError(404, "Post not found.");
      return respond(result(post));
    }
    const creating =
      request.method === "POST" && resource === "posts" && path.length === 1;
    const editing =
      request.method === "PUT" && resource === "posts" && path.length === 2;
    if (!creating && !editing && !uploading)
      throw new ApiError(404, "Endpoint not found.");
    const key = request.headers.get("idempotency-key") ?? "";
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(key))
      throw new ApiError(
        400,
        "Supply a unique Idempotency-Key (16–128 letters, digits, underscores or hyphens).",
      );
    const mime = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!uploading && mime !== "application/json")
      throw new ApiError(415, "Use application/json.");
    const bytes = await readBody(
      request,
      uploading ? MAX_IMAGE_BYTES : 256 * 1024,
    );
    let input: unknown;
    if (!uploading) {
      try {
        input = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw new ApiError(400, "Invalid JSON body.");
      }
    }
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(["save-to-public", request.method, path, mime]))
      .update(bytes)
      .digest("hex");
    // Prepare the durable cleanup marker before reserving the transaction connection.
    // A crashed upload or rolled-back receipt leaves its object eligible for cleanup.
    let pendingId: string | undefined;
    if (uploading) {
      const [prior] =
        await db()`select fingerprint, response from api_requests where key = ${key}`;
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ApiError(
            409,
            "This Idempotency-Key was already used for another request.",
          );
        return respond(prior.response);
      }
      pendingId = randomUUID();
      await db()`insert into storage_cleanup (object_key, not_before) values (${`uploads/${pendingId}`}, now() + interval '24 hours')`;
    }
    const response = await db().begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      const [receipt] =
        await tx`select fingerprint, response from api_requests where key = ${key}`;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new ApiError(
            409,
            "This Idempotency-Key was already used for another request.",
          );
        return receipt.response;
      }
      let body: unknown;
      if (uploading) {
        body = {
          image: await uploadImage(credential, bytes, mime, tx, pendingId),
        };
      } else if (creating) {
        body = result(await createPost(credential, content.parse(input), tx));
      } else {
        const data = content
          .extend({ version: revision.shape.version })
          .strict()
          .parse(input);
        await tx`select pg_advisory_xact_lock(hashtextextended(${id}, 2))`;
        const post = await ownerPost(id, credential, tx);
        if (!post) throw new ApiError(404, "Post not found.");
        if (data.version !== post.version)
          throw new ApiError(409, "Post changed. Read it again before saving.");
        body = result(await savePost(credential, { ...data, id }, tx));
      }
      await tx`insert into api_requests (key, fingerprint, response) values (${key}, ${fingerprint}, ${tx.json(body as JSONValue)})`;
      return body;
    });
    return respond(response);
  } catch (error) {
    if (error instanceof ApiError)
      return respond({ error: error.message }, error.status);
    if (error instanceof InputError)
      return respond({ error: error.message }, 400);
    if (error instanceof z.ZodError)
      return respond({ error: "Invalid fields or field lengths." }, 400);
    console.error(
      JSON.stringify({
        event: "api.request.failed",
        requestId,
        method: request.method,
        postId: z.uuid().safeParse(path[1]).success ? path[1] : undefined,
        action: path[0] === "images" ? "images" : "posts",
        status: 503,
        durationMs: Date.now() - started,
        error: errorDetails(error),
      }),
    );
    return respond(
      {
        error: "Operation failed. Retry with the same Idempotency-Key.",
        requestId,
      },
      503,
    );
  }
}
