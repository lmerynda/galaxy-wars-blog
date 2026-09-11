import { formatDate, videoUrl, type Post } from "@/lib/post";
import { Discussion } from "./Discussion";
import { entryAnchor } from "@/lib/day";

export function PostView({
  post,
  preview = false,
  entryNumber,
}: {
  post: Post;
  preview?: boolean;
  entryNumber?: number;
}) {
  const Heading = entryNumber ? "h2" : "h1";
  return (
    <article
      className={`post-view ${entryNumber ? "day-entry" : ""}`}
      id={entryNumber ? entryAnchor(post) : undefined}
    >
      <header className="post-header">
        <div className="eyebrow">
          {preview
            ? "Preview · only visible to you"
            : entryNumber
              ? `${String(entryNumber).padStart(2, "0")} / Development update`
              : "Development update"}
        </div>
        <Heading>{post.title || "Your next chapter"}</Heading>
        {entryNumber ? (
          <a
            className="entry-permalink"
            href={`#${entryAnchor(post)}`}
            aria-label={`Link to entry: ${post.title}`}
          >
            Link to this update ↗
          </a>
        ) : (
          <div className="post-meta">
            <span className="status-dot" />{" "}
            <time dateTime={post.publishedDay ?? undefined}>
              {formatDate(post.publishedDay)}
            </time>
            <span className="meta-divider">/</span>
            <span>Galaxy Wars</span>
          </div>
        )}
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
      <section className="comparison" aria-label="Image gallery">
        {post.images.map((image, index) => {
          const role = image.role;
          return (
            <figure key={image.id} className={`screenshot screenshot-${role}`}>
              <figcaption>
                <span className="eyebrow">
                  {role === "gallery" ? `Image ${index + 1}` : role}
                </span>
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
      {!preview && post.published && <Discussion postId={post.id} />}
      {!entryNumber && (
        <div className="post-end">
          <span className="star-mark">✳</span>
          <span>One change. A better galaxy.</span>
        </div>
      )}
    </article>
  );
}
