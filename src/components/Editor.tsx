"use client";
import { useEffect, useRef, useState } from "react";
import { save } from "@/app/admin/actions";
import { PostView } from "./PostView";
import {
  videoUrl,
  youtubeId,
  type Post,
  type PostImage,
  type PostInput,
  type Role,
} from "@/lib/post";

function fields(post: Post): PostInput {
  return {
    id: post.id,
    version: post.version,
    title: post.title,
    paragraphOne: post.paragraphOne,
    paragraphTwo: post.paragraphTwo,
    youtubeUrl: post.videoId ? videoUrl(post.videoId) : "",
    beforeId: post.images.find((i) => i.role === "before")?.id ?? "",
    afterId: post.images.find((i) => i.role === "after")?.id ?? "",
    beforeAlt: post.images.find((i) => i.role === "before")?.alt ?? "",
    afterAlt: post.images.find((i) => i.role === "after")?.alt ?? "",
    intent: post.published ? "publish" : "draft",
  };
}
function upload(
  postId: string,
  role: Role,
  file: File,
  onProgress: (value: number) => void,
) {
  return new Promise<PostImage>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/posts/${postId}/images`);
    request.timeout = 120000;
    request.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    request.onload = () => {
      try {
        const data = JSON.parse(request.responseText);
        if (request.status >= 400 || !data.image)
          reject(new Error(data.error || "Upload failed. Please try again."));
        else resolve(data.image);
      } catch {
        reject(new Error("Upload failed. Please try again."));
      }
    };
    request.onerror = () =>
      reject(
        new Error("Upload interrupted. Your previous screenshot is unchanged."),
      );
    request.ontimeout = () =>
      reject(new Error("Upload timed out. Please try again."));
    const form = new FormData();
    form.set("image", file);
    form.set("role", role);
    request.send(form);
  });
}
export function Editor({ initial }: { initial: Post }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(() => fields(initial));
  const [images, setImages] = useState(initial.images);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Role | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(fields(saved));
  const busy = saving || uploading !== null;
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const navigation = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a");
      if (
        (dirty || busy) &&
        anchor &&
        anchor.target !== "_blank" &&
        !anchor.getAttribute("href")?.startsWith("#") &&
        !window.confirm("Leave the editor? Unsaved changes will be lost.")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty, busy]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function change(key: keyof PostInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage("");
  }
  async function selectImage(role: Role, file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 10 * 1024 * 1024) {
      setError("Screenshots must be no larger than 10 MiB.");
      return;
    }
    setUploading(role);
    setProgress(0);
    try {
      const image = await upload(initial.id, role, file, setProgress);
      setImages((prev) => [...prev.filter((i) => i.role !== role), image]);
      change(`${role}Id`, image.id);
      setMessage("Screenshot ready. Save the post to keep this replacement.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }
  async function submit(intent: PostInput["intent"]) {
    if (
      intent === "unpublish" &&
      !window.confirm(
        "Unpublish this update? Its page and screenshots will no longer be available to readers.",
      )
    )
      return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await save({ ...form, intent });
      if (result.error) setError(result.error);
      else if (result.post) {
        setSaved(result.post);
        setForm(fields(result.post));
        setImages(result.post.images);
        setMessage(
          intent === "unpublish"
            ? "Unpublished. Your post is now a private draft."
            : intent === "publish"
              ? "Published and saved. Your update is live."
              : "Draft saved. Only you can see it.",
        );
      }
    } catch {
      setError(
        "Connection interrupted. Your changes are still here; please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  let previewVideo: string | null = null;
  try {
    previewVideo = youtubeId(form.youtubeUrl);
  } catch {
    /* Invalid links stay out of preview; save reports the error. */
  }
  const previewPost: Post = {
    ...saved,
    title: form.title,
    paragraphOne: form.paragraphOne.replace(/\s+/g, " ").trim(),
    paragraphTwo: form.paragraphTwo.replace(/\s+/g, " ").trim(),
    videoId: previewVideo,
    images: images.map((i) => ({ ...i, alt: form[`${i.role}Alt`] })),
  };
  return (
    <>
      <a className="back-link" href="/admin">
        ← Your updates
      </a>
      <div className="admin-heading editor-heading">
        <div>
          <p className="eyebrow">
            Owner studio /{" "}
            {saved.published ? "Published update" : "Private draft"}
          </p>
          <h1>
            {saved.title ? "Refine the story." : "Write the next chapter."}
          </h1>
        </div>
        <button
          className="button"
          onClick={() => setPreview((v) => !v)}
          aria-pressed={preview}
        >
          {preview ? "← Back to editor" : "Preview update ↗"}
        </button>
      </div>
      <p
        ref={errorRef}
        tabIndex={-1}
        role="alert"
        className={`form-error ${error ? "error-box" : ""}`}
      >
        {error}
      </p>
      <div hidden={preview}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(saved.published ? "publish" : "draft");
          }}
        >
          <fieldset disabled={busy} className="editor-fields">
            <section className="panel editor-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">01 / The story</p>
                  <h2>Two paragraphs. One change.</h2>
                </div>
              </div>
              <label htmlFor="title">
                Update title
                <span className="field-hint">Give the change a clear name</span>
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
                maxLength={120}
                placeholder="A clearer view of the galaxy"
              />
              <div className="text-grid">
                <div>
                  <label htmlFor="paragraphOne">
                    What needed improvement?
                    <span className="field-hint">
                      The context, problem, or opportunity.
                    </span>
                  </label>
                  <textarea
                    id="paragraphOne"
                    value={form.paragraphOne}
                    onChange={(e) => change("paragraphOne", e.target.value)}
                    maxLength={1500}
                    rows={7}
                    placeholder="Before this change…"
                  />
                  <span className="character-count">
                    {form.paragraphOne.length} / 1,500
                  </span>
                </div>
                <div>
                  <label htmlFor="paragraphTwo">
                    What changed?
                    <span className="field-hint">
                      The result, from the player’s point of view.
                    </span>
                  </label>
                  <textarea
                    id="paragraphTwo"
                    value={form.paragraphTwo}
                    onChange={(e) => change("paragraphTwo", e.target.value)}
                    maxLength={1500}
                    rows={7}
                    placeholder="Now, players can…"
                  />
                  <span className="character-count">
                    {form.paragraphTwo.length} / 1,500
                  </span>
                </div>
              </div>
            </section>
            <section className="panel editor-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">02 / The evidence</p>
                  <h2>Show the difference.</h2>
                </div>
                <span className="muted upload-hint">
                  PNG, JPEG or WebP · up to 10 MiB each
                </span>
              </div>
              <div className="text-grid">
                {(["before", "after"] as const).map((role) => {
                  const image = images.find((i) => i.role === role);
                  return (
                    <div className="upload-column" key={role}>
                      <label className="upload-label" htmlFor={`${role}File`}>
                        <span className="eyebrow">{role}</span>
                        <span className="field-hint">
                          {image
                            ? "Choose a file to replace this screenshot"
                            : "Choose a screenshot"}
                        </span>
                      </label>
                      <div className="upload-preview">
                        {image ? (
                          <img
                            src={image.url}
                            alt={`${role} upload preview`}
                            width={image.width}
                            height={image.height}
                          />
                        ) : (
                          <span>
                            <span className="image-symbol">＋</span>The {role}{" "}
                            view
                          </span>
                        )}
                      </div>
                      <input
                        className="file-input"
                        id={`${role}File`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          void selectImage(role, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      {uploading === role && (
                        <p role="status" className="upload-progress">
                          {progress < 100
                            ? `Uploading… ${progress}%`
                            : "Validating screenshot…"}
                        </p>
                      )}
                      <label htmlFor={`${role}Alt`}>
                        Image description
                        <span className="field-hint">
                          Help readers understand what’s visible.
                        </span>
                      </label>
                      <input
                        id={`${role}Alt`}
                        value={form[`${role}Alt`]}
                        onChange={(e) => change(`${role}Alt`, e.target.value)}
                        maxLength={200}
                        placeholder={
                          role === "before"
                            ? "Describe the original view"
                            : "Describe the improved view"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="panel editor-panel video-field">
              <div>
                <p className="eyebrow">03 / In motion · optional</p>
                <h2>A little more to show?</h2>
                <p className="muted">
                  Add a link if a video tells the story better.
                </p>
              </div>
              <div>
                <label htmlFor="youtubeUrl">YouTube video link</label>
                <input
                  type="url"
                  id="youtubeUrl"
                  value={form.youtubeUrl}
                  onChange={(e) => change("youtubeUrl", e.target.value)}
                  maxLength={2048}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </div>
            </section>
          </fieldset>
          <button className="sr-only" type="submit" disabled={busy}>
            Save update
          </button>
        </form>
      </div>
      {preview && (
        <div className="preview-surface panel">
          <PostView post={previewPost} preview />
        </div>
      )}
      <div className="save-bar">
        <div aria-live="polite">
          <strong>
            {saving
              ? "Saving your update…"
              : dirty
                ? "Unsaved changes"
                : saved.published
                  ? "Published update"
                  : "Private draft"}
          </strong>
          <p className="muted">
            {message ||
              (saved.published
                ? "Changes go live when you save."
                : "Only you can see this until you publish.")}
          </p>
          {saved.published && (
            <a href={`/updates/${saved.slug}`} target="_blank" rel="noreferrer">
              View public page ↗
            </a>
          )}
        </div>
        <div className="actions">
          {saved.published ? (
            <>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() => void submit("unpublish")}
              >
                Unpublish
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void submit("publish")}
              >
                Save changes →
              </button>
            </>
          ) : (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => void submit("draft")}
              >
                Save draft
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void submit("publish")}
              >
                Publish update →
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
