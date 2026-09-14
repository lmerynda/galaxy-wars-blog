import Link from "next/link";
import { recentComments } from "@/server/comment-feed";
export const dynamic = "force-dynamic";
export const metadata = { title: "Comments" };
export default async function Comments({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = (await searchParams).page;
  const page =
    raw && /^\d+$/.test(raw) ? Math.max(1, Math.min(100000, Number(raw))) : 1;
  const { comments, hasMore } = await recentComments(page);
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.BLOG_TIME_ZONE || "America/Chicago",
  });
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Across the galaxy</p>
          <h1>Latest comments.</h1>
          <p className="lede">
            Comments and replies from every update, newest first.
          </p>
        </div>
      </div>
      <div className="recent-comments">
        {comments.length ? (
          comments.map((c) => (
            <article className="panel recent-comment" key={c.id}>
              <div className="recent-comment-meta">
                <strong>{c.name}</strong>
                <span className="muted">
                  {c.reply ? "Reply · " : ""}
                  <time dateTime={c.createdAt}>
                    {date.format(new Date(c.createdAt))}
                  </time>
                </span>
              </div>
              <p className="comment-body">{c.body}</p>
              <Link
                className="entry-permalink"
                href={`/days/${c.day}#entry-${c.postId}`}
              >
                {c.title || "Untitled update"} · View discussion ↗
              </Link>
            </article>
          ))
        ) : (
          <p className="panel recent-comment">
            {page === 1 ? "No comments yet." : "No more comments."}
          </p>
        )}
      </div>
      <nav className="pagination" aria-label="Comments pages">
        {page > 1 && (
          <Link className="button" href={`/comments?page=${page - 1}`}>
            ← Newer comments
          </Link>
        )}
        {hasMore && (
          <Link className="button" href={`/comments?page=${page + 1}`}>
            Older comments →
          </Link>
        )}
      </nav>
    </>
  );
}
