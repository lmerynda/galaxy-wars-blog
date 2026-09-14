import { commentCount } from "@/server/comment-feed";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      { count: await commentCount() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Comment count unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
