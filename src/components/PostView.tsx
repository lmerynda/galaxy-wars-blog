import { formatDate, videoUrl, type Post } from "@/lib/post";

export function PostView({
  post,
  preview = false,
}: {
  post: Post;
  preview?: boolean;
}) {
  return (
    <article className="post-view">
      <header className="post-header">
        <div className="eyebrow">
          {preview ? "Preview · only visible to you" : "Development update"}
        </div>
        <h1>{post.title || "Your next chapter"}</h1>
        <div className="post-meta">
          <span className="status-dot" />{" "}
          <time dateTime={post.publishedAt ?? undefined}>
            {formatDate(post.publishedAt)}
          </time>
          <span className="meta-divider">/</span>
          <span>Galaxy Wars</span>
        </div>
      </header>
      <div className="post-copy">
        <p>
          {post.paragraphOne || "Describe what needed improvement and why."}
        </p>
        <p>
          {post.paragraphTwo ||
            "Explain what changed and what players can now see or do."}
        </p>
      </div>
      <section className="comparison" aria-label="Before and after screenshots">
        {(["before", "after"] as const).map((role) => {
          const image = post.images.find((i) => i.role === role);
          return (
            <figure key={role} className={`screenshot screenshot-${role}`}>
              <figcaption>
                <span className="eyebrow">{role}</span>
                <span className="muted">
                  {image ? "Open full resolution ↗" : "Screenshot preview"}
                </span>
              </figcaption>
              {image ? (
                <a
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${role} screenshot in full resolution`}
                >
                  <img
                    src={image.url}
                    width={image.width}
                    height={image.height}
                    alt={image.alt || `${role} screenshot`}
                  />
                </a>
              ) : (
                <div className="image-empty">
                  <span className="image-symbol">＋</span>Add the {role}{" "}
                  screenshot
                </div>
              )}
              {image?.alt && <p className="image-caption">{image.alt}</p>}
            </figure>
          );
        })}
      </section>
      {post.videoId && (
        <a
          className="video-link"
          href={videoUrl(post.videoId)}
          target="_blank"
          rel="noreferrer"
        >
          <span className="play-icon">▶</span>
          <span>
            <strong>See it in motion</strong>
            <small>Watch on YouTube ↗</small>
          </span>
        </a>
      )}
      <div className="post-end">
        <span className="star-mark">✳</span>
        <span>One change. A better galaxy.</span>
      </div>
    </article>
  );
}
