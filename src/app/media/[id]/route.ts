import { ownerToken } from "@/server/http";
import { readImage } from "@/server/images";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const image = await readImage((await params).id, await ownerToken());
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
  } catch {
    return new Response("Screenshot unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
