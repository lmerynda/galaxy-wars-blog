import { ownerToken } from "@/server/http";
import { mediaResponse } from "@/server/images";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mediaResponse((await params).id, await ownerToken());
}
