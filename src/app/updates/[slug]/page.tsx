import { notFound, redirect } from "next/navigation";
import { publicPost } from "@/server/posts";
import { postUrl } from "@/lib/day";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
// Existing shared entry URLs open the matching entry within its daily page.
export default async function Update({ params }: Props) {
  const post = await publicPost((await params).slug);
  if (!post) notFound();
  redirect(postUrl(post));
}
