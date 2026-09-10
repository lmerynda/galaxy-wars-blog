import { notFound } from "next/navigation";
import { ownerPage } from "@/server/http";
import { ownerPost } from "@/server/posts";
import { Editor } from "@/components/Editor";
export const dynamic = "force-dynamic";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await ownerPost(id, await ownerPage(`/admin/posts/${id}/edit`));
  if (!post) notFound();
  return <Editor initial={post} />;
}
