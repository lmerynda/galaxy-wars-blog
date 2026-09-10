import { requireOwner } from "@/server/auth";
import { MAX_IMAGE_BYTES, uploadImage } from "@/server/images";
import { mutationToken, safeError } from "@/server/http";
import { AuthError, InputError } from "@/lib/post";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await mutationToken();
    await requireOwner(token);
    const maxBody = MAX_IMAGE_BYTES + 64 * 1024;
    if (Number(request.headers.get("content-length")) > maxBody)
      return Response.json(
        { error: "Screenshot is too large." },
        { status: 413 },
      );
    // Bound chunked bodies too; Content-Length alone is not a trustworthy limit.
    const reader = request.body?.getReader();
    if (!reader) throw new InputError("Choose a screenshot.");
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBody) {
          await reader.cancel();
          return Response.json(
            { error: "Screenshot is too large." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new InputError("Choose a screenshot.");
    const image = await uploadImage(
      token,
      (await params).id,
      String(form.get("role")),
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    return Response.json(
      { image },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: safeError(error) },
      {
        status:
          error instanceof AuthError
            ? 401
            : error instanceof InputError
              ? 400
              : 503,
      },
    );
  }
}
