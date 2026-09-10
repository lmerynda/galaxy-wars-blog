import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPost } from "@/server/posts";
import { PostView } from "@/components/PostView";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await publicPost((await params).slug);
  if (!post) return { title: "Update not found" };
  const image = post.images.find((i) => i.role === "after");
  return {
    title: post.title,
    description: post.paragraphOne.slice(0, 180),
    alternates: { canonical: `/updates/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.paragraphOne.slice(0, 180),
      publishedTime: post.publishedAt!,
      images: image
        ? [
            {
              url: image.url,
              width: image.width,
              height: image.height,
              alt: image.alt,
            },
          ]
        : [],
    },
    twitter: { card: "summary_large_image" },
  };
}
export default async function Update({ params }: Props) {
  const post = await publicPost((await params).slug);
  if (!post) notFound();
  return (
    <>
      <Link href="/" className="back-link">
        ← All updates
      </Link>
      <PostView post={post} />
    </>
  );
}
