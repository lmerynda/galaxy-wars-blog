import { formatDate, videoUrl, type Post } from "@/lib/post";
import { Discussion } from "./Discussion";
import { entryAnchor } from "@/lib/day";

export function PostView({
  post,
  entryNumber,
}: {
  post: Post;
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
          {entryNumber
            ? `${String(entryNumber).padStart(2, "0")} / Development update`
            : "Development update"}
        </div>
        <Heading>{post.title || "Untitled update"}</Heading>
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
        <p>{post.paragraphOne}</p>
        <p>{post.paragraphTwo}</p>
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
                <span className="muted">Open full resolution ↗</span>
              </figcaption>
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
              {image.alt && <p className="image-caption">{image.alt}</p>}
            </figure>
          );
        })}
      </section>
      {post.videoIds.map((id, index) => (
        <div className="embedded-video" key={`${id}-${index}`}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={`${post.title || "Update"} — video ${index + 1}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <a
            className="video-link"
            href={videoUrl(id)}
            target="_blank"
            rel="noreferrer"
          >
            Watch on YouTube ↗
          </a>
        </div>
      ))}
      <Discussion postId={post.id} />
      {!entryNumber && (
        <div className="post-end">
          <span className="star-mark">✳</span>
          <span>One change. A better galaxy.</span>
        </div>
      )}
    </article>
  );
}
