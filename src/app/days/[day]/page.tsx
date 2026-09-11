import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicDay } from "@/server/posts";
import { dayUrl, formatDay, entryAnchor } from "@/lib/day";
import { PostView } from "@/components/PostView";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ day: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const day = await publicDay((await params).day);
  if (!day) return { title: "Day not found" };
  const title = `${formatDay(day.day)} — Development log`;
  const description =
    `${day.posts.length} ${day.posts.length === 1 ? "update" : "updates"}: ${day.posts.map((post) => post.title).join("; ")}`.slice(
      0,
      180,
    );
  const image = day.posts
    .at(-1)
    ?.images.find((image) => image.role === "after");
  return {
    title,
    description,
    alternates: { canonical: dayUrl(day.day) },
    openGraph: {
      type: "article",
      title,
      description,
      url: dayUrl(day.day),
      publishedTime: day.posts[0].publishedAt!,
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
export default async function DayPage({ params }: Props) {
  const day = await publicDay((await params).day);
  if (!day) notFound();
  return (
    <>
      <Link href="/" className="back-link">
        ← All days
      </Link>
      <header className="day-header">
        <p className="eyebrow">Daily field notes</p>
        <h1>
          <time dateTime={day.day}>{formatDay(day.day)}</time>
        </h1>
        <p className="lede">
          {day.posts.length} {day.posts.length === 1 ? "update" : "updates"}{" "}
          from a galaxy in progress.
        </p>
        {day.posts.length > 1 && (
          <nav className="day-contents" aria-label="This day’s updates">
            {day.posts.map((post, index) => (
              <a href={`#${entryAnchor(post)}`} key={post.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {post.title}
                <span aria-hidden="true">↘</span>
              </a>
            ))}
          </nav>
        )}
      </header>
      <div className="day-entries">
        {day.posts.map((post, index) => (
          <PostView key={post.id} post={post} entryNumber={index + 1} />
        ))}
      </div>
      <div className="post-end">
        <span className="star-mark">✳</span>
        <span>One day. A better galaxy.</span>
      </div>
    </>
  );
}
