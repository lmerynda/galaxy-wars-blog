import { videoUrl, type Post } from "@/lib/post";
import { Discussion } from "./Discussion";
import { entryAnchor } from "@/lib/day";

export function PostView({
  post,
  entryNumber,
}: {
  post: Post;
  entryNumber: number;
}) {
  const anchor = entryAnchor(post);
  return (
    <article className="hud-panel day-entry" id={anchor}>
      <header className="post-header">
        <p className="entry-number">Update {entryNumber}</p>
        <h2>{post.title || "Untitled update"}</h2>
        <a
          className="entry-permalink"
          href={`#${anchor}`}
          aria-label={`Link to entry: ${post.title}`}
        >
          Link to this update
        </a>
      </header>
      <div className="post-copy">
        <p>{post.paragraphOne}</p>
        <p>{post.paragraphTwo}</p>
      </div>
      {post.images.length > 0 && (
        <section className="gallery" aria-label="Image gallery">
          {post.images.map((image, index) => (
            <figure key={image.id} className="screenshot">
              <a
                className="lock"
                href={image.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open image ${index + 1} in full resolution`}
              >
                <img
                  src={image.url}
                  width={image.width}
                  height={image.height}
                  alt={image.alt || `Image ${index + 1}`}
                />
              </a>
              {image.alt && <figcaption>{image.alt}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      {post.videoIds.map((id, index) => (
        <div className="embedded-video" key={`${id}-${index}`}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={`${post.title || "Update"}, video ${index + 1}`}
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
            Watch on YouTube
          </a>
        </div>
      ))}
      <Discussion postId={post.id} />
    </article>
  );
}
