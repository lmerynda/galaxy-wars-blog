import Link from "next/link";
import { publicPosts } from "@/server/posts";
import { formatDate } from "@/lib/post";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = (await searchParams).page;
  const page =
    raw && /^\d+$/.test(raw) ? Math.max(1, Math.min(100000, Number(raw))) : 1;
  const { posts, hasMore } = await publicPosts(page);
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">Field notes from development</p>
          <h1>
            A galaxy,
            <br />
            taking <span>shape.</span>
          </h1>
          <p className="lede">
            The small changes behind a bigger universe.
            <br />
            Follow the progress of Galaxy Wars, before and after.
          </p>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <span className="orbit-core">✳</span>
          <span className="orbital-point point-one" />
          <span className="orbital-point point-two" />
          <span className="orbit-label">
            GALAXY WARS
            <br />
            WORK IN PROGRESS
          </span>
        </div>
      </section>
      <section aria-labelledby="updates-title">
        <div className="section-heading">
          <h2 id="updates-title">
            Latest transmissions<span className="heading-dot">.</span>
          </h2>
          <span className="eyebrow muted">The development journal</span>
        </div>
        {posts.length ? (
          <div className="post-grid">
            {posts.map((post) => {
              const image = post.images.find((i) => i.role === "after");
              return (
                <Link
                  className="post-card"
                  key={post.id}
                  href={`/updates/${post.slug}`}
                >
                  <div className="card-image">
                    {image && (
                      <img
                        src={image.url}
                        width={image.width}
                        height={image.height}
                        alt={image.alt}
                        loading="lazy"
                      />
                    )}
                    <span className="image-badge">Before &amp; after</span>
                  </div>
                  <div className="card-body">
                    <time
                      className="eyebrow muted"
                      dateTime={post.publishedAt!}
                    >
                      {formatDate(post.publishedAt)}
                    </time>
                    <h3>{post.title}</h3>
                    <p>{post.paragraphOne}</p>
                    <span className="card-link">
                      Read the update <span aria-hidden="true">↗</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state panel">
            <span className="empty-icon" aria-hidden="true">
              ✳
            </span>
            <div>
              <p className="eyebrow">
                {page === 1 ? "The beginning of something" : "End of the log"}
              </p>
              <h3>
                {page === 1
                  ? "First transmission coming soon."
                  : "You’re all caught up."}
              </h3>
              <p>
                {page === 1
                  ? "New features, thoughtful fixes, and the screenshots that tell the story. Our first development update will appear here."
                  : "There are no more updates on this page."}
              </p>
            </div>
          </div>
        )}
        {(page > 1 || hasMore) && (
          <nav className="pagination" aria-label="Update pages">
            {page > 1 ? (
              <Link className="button" href={`/?page=${page - 1}`}>
                ← Newer updates
              </Link>
            ) : (
              <span />
            )}
            <span className="muted">Page {page}</span>
            {hasMore ? (
              <Link className="button" href={`/?page=${page + 1}`}>
                Older updates →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
