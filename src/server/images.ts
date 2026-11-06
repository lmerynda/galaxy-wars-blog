import sharp from "sharp";
import type { TransactionSql } from "postgres";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { requireOwner, sessionValid, type OwnerCredential } from "./auth";
import { deleteObject, getObject, putObject } from "./storage";
import { InputError, type PostImage } from "../lib/post";
import { OperationError, errorDetails } from "./diagnostics";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export async function inspectImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new InputError("Screenshots must be no larger than 10 MiB.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 32000000,
      animated: true,
      failOn: "warning",
    });
    const meta = await image.metadata();
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const expected = mimeTypes[meta.format ?? ""];
    if (
      !expected ||
      mime !== expected ||
      (meta.pages ?? 1) !== 1 ||
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 32000000
    )
      throw new Error();
    await image.stats(); // Force full decoding, rather than trusting only the header.
    return {
      width: meta.width,
      height: meta.height,
      mime: expected,
      bytes: bytes.length,
    };
  } catch {
    throw new InputError(
      "Choose a valid, still PNG, JPEG, or WebP screenshot up to 32 megapixels.",
    );
  }
}
export async function uploadImage(
  token: OwnerCredential,
  bytes: Buffer,
  mime: string,
  transaction?: TransactionSql,
  pendingId?: string,
): Promise<PostImage> {
  await requireOwner(token);
  const sql = transaction ?? db();
  const meta = await inspectImage(bytes, mime);
  const id = pendingId ?? randomUUID(),
    key = `uploads/${id}`;
  // A durable marker exists even if the process stops between upload and the image insert.
  if (!pendingId)
    await db()`insert into storage_cleanup (object_key, not_before) values (${key}, now() + interval '24 hours')`;
  try {
    await putObject(key, bytes, mime);
  } catch (error) {
    throw new OperationError("storage.putObject", error);
  }
  try {
    await sql`insert into post_images (id, role, object_key, mime, width, height, bytes) values (${id}, ${"gallery"}, ${key}, ${meta.mime}, ${meta.width}, ${meta.height}, ${meta.bytes})`;
  } catch (error) {
    throw new OperationError("database.insertImage", error);
  }
  return {
    id,
    role: "gallery",
    url: `/media/${id}`,
    width: meta.width,
    height: meta.height,
    alt: "",
  };
}
export async function readImage(id: string, token?: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] =
    await db()`select i.object_key, i.mime, i.bytes, (i.post_id is not null and i.active) as public from post_images i where i.id = ${id}`;
  if (!row || (!row.public && !(await sessionValid(token)))) return null;
  let result;
  try {
    result = await getObject(row.object_key);
  } catch (error) {
    // The row exists but its object is gone: a missing screenshot, not an outage.
    if ((error as { name?: string })?.name === "NoSuchKey") {
      console.error(
        JSON.stringify({ event: "media.object.missing", imageId: id }),
      );
      return null;
    }
    throw new OperationError("storage.getObject", error);
  }
  return {
    body: result.Body?.transformToWebStream(),
    mime: row.mime as string,
    bytes: row.bytes as number,
  };
}
export async function mediaResponse(id: string, token?: string) {
  const started = Date.now();
  try {
    const image = await readImage(id, token);
    if (!image?.body)
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    return new Response(image.body as ReadableStream, {
      headers: {
        "Content-Type": image.mime,
        "Content-Length": String(image.bytes),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "media.read.failed",
        imageId: z.uuid().safeParse(id).success ? id : undefined,
        status: 503,
        durationMs: Date.now() - started,
        error: errorDetails(error),
      }),
    );
    return new Response("Screenshot unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
export async function cleanupStorage() {
  const rows =
    await db()`select object_key from storage_cleanup where not_before < now() order by not_before limit 100`;
  let deleted = 0,
    failed = 0;
  for (const row of rows) {
    try {
      await db().begin(async (tx) => {
        // Lock the marker before deleting. Saving an image takes the same lock.
        const markers =
          await tx`select object_key from storage_cleanup where object_key = ${row.object_key} and not_before < now() for update`;
        if (!markers.length) return;
        const active =
          await tx`select id from post_images where object_key = ${row.object_key} and active`;
        if (!active.length) {
          await deleteObject(row.object_key);
          await tx`delete from post_images where object_key = ${row.object_key} and not active`;
          deleted++;
        }
        await tx`delete from storage_cleanup where object_key = ${row.object_key}`;
      });
    } catch {
      failed++;
      await db()`update storage_cleanup set attempts = attempts + 1, not_before = now() + interval '1 hour' where object_key = ${row.object_key}`;
    }
  }
  return { deleted, failed };
}
