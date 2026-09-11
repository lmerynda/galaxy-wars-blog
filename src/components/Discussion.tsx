"use client";
import { useEffect, useState } from "react";
import {
  loadDiscussion,
  sendComment,
  castVote,
  configurePoll,
  hideComment,
} from "@/app/discussion-actions";
import type { Comment, DiscussionData } from "@/lib/discussion";

export function Discussion({
  postId,
  admin = false,
}: {
  postId: string;
  admin?: boolean;
}) {
  const [data, setData] = useState<DiscussionData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<Comment | null>(null);
  const [request, setRequest] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Proposal A\nProposal B");
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadDiscussion(postId, admin).then((result) => {
      if (!active) return;
      if (result.data) {
        setData(result.data);
        if (result.data.poll) {
          setQuestion(result.data.poll.question);
          setOptions(result.data.poll.options.map((o) => o.label).join("\n"));
          setClosed(result.data.poll.closed);
        }
      }
      if (result.error) setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [postId, admin]);
  async function run(
    action: () => Promise<{ data?: DiscussionData; error?: string }>,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return false;
      }
      if (result.data) setData(result.data);
      return true;
    } catch {
      setError("Connection interrupted. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const poll = data?.poll;
  const CommentsHeading = admin ? "h2" : "h3";
  const ordered: { comment: Comment; depth: number }[] = [];
  const children = new Map<string | null, Comment[]>();
  for (const comment of data?.comments ?? [])
    children.set(comment.parentId, [
      ...(children.get(comment.parentId) ?? []),
      comment,
    ]);
  const stack = (children.get(null) ?? [])
    .slice()
    .reverse()
    .map((comment) => ({ comment, depth: 0 }));
  while (stack.length) {
    const item = stack.pop()!;
    ordered.push(item);
    for (const child of (children.get(item.comment.id) ?? []).slice().reverse())
      stack.push({ comment: child, depth: item.depth + 1 });
  }
  return (
    <section
      className="discussion panel"
      aria-label={
        admin ? "Poll and comment management" : "Discussion and voting"
      }
    >
      <p className="form-error" role="alert">
        {error}
      </p>
      {!data && !error && <p>Loading discussion…</p>}
      {admin && data && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              configurePoll(postId, {
                version: poll?.version ?? 0,
                question,
                options: options
                  .split("\n")
                  .map((o) => o.trim())
                  .filter(Boolean),
                closed,
              }),
            );
          }}
        >
          <h2>{poll ? "Manage poll" : "Add a poll"}</h2>
          <fieldset disabled={busy}>
            <label htmlFor={`question-${postId}`}>Question</label>
            <input
              id={`question-${postId}`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
              required
              readOnly={!!poll?.total}
            />
            <label htmlFor={`options-${postId}`}>Choices, one per line</label>
            <textarea
              id={`options-${postId}`}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              rows={4}
              required
              readOnly={!!poll?.total}
            />
            {!!poll?.total && (
              <p className="muted">
                The question and choices are fixed because voting has started.
              </p>
            )}
            <label>
              <input
                type="checkbox"
                checked={closed}
                onChange={(e) => setClosed(e.target.checked)}
              />{" "}
              Voting closed
            </label>
            <button className="button" type="submit">
              {poll ? "Save poll" : "Create poll"}
            </button>
          </fieldset>
        </form>
      )}
      {poll && (
        <div className="poll">
          <p className="eyebrow">
            {poll.closed ? "Poll closed" : "Community vote"}
          </p>
          <h3>{poll.question}</h3>
          {poll.options.map((option) => (
            <div className="poll-option" key={option.id}>
              <button
                className={`button ${poll.selected === option.id ? "button-primary" : ""}`}
                disabled={busy || poll.closed || admin}
                aria-pressed={poll.selected === option.id}
                onClick={() => void run(() => castVote(postId, option.id))}
              >
                {option.label}
                {poll.selected === option.id ? " ✓" : ""}
              </button>
              <span>
                {option.count} ·{" "}
                {poll.total ? Math.round((option.count / poll.total) * 100) : 0}
                %
              </span>
              <progress
                max={Math.max(poll.total, 1)}
                value={option.count}
                aria-label={`${option.label} votes`}
              />
            </div>
          ))}
          <p className="muted">
            {poll.total} {poll.total === 1 ? "vote" : "votes"}
            {!admin && !poll.closed
              ? " · One choice per browser. You can change your vote."
              : ""}
          </p>
        </div>
      )}
      <CommentsHeading>
        Comments
        {data ? ` (${data.comments.filter((c) => !c.hidden).length})` : ""}
      </CommentsHeading>
      {data && ordered.length === 0 && (
        <p className="muted">No comments yet.</p>
      )}
      <div className="comment-list">
        {ordered.map(({ comment, depth }) => (
          <article
            className="comment"
            id={`comment-${comment.id}`}
            key={comment.id}
            style={{ marginInlineStart: `${Math.min(depth, 4) * 16}px` }}
          >
            <strong>{comment.hidden ? "Comment removed" : comment.name}</strong>{" "}
            <time dateTime={comment.createdAt}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </time>
            {comment.parentId && (
              <a href={`#comment-${comment.parentId}`} className="muted">
                {" "}
                ↳ Reply
              </a>
            )}
            {!comment.hidden && <p className="comment-body">{comment.body}</p>}
            {admin ? (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    hideComment(postId, comment.id, !comment.hidden),
                  )
                }
              >
                {comment.hidden ? "Restore" : "Hide"}
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setReply(comment);
                  document.getElementById(`comment-body-${postId}`)?.focus();
                }}
              >
                Reply
              </button>
            )}
          </article>
        ))}
      </div>
      {!admin && data && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const text = JSON.stringify([name, body, reply?.id]);
            const id =
              request?.text === text ? request.id : crypto.randomUUID();
            setRequest({ id, text });
            if (
              await run(() =>
                sendComment(postId, {
                  id,
                  name,
                  body,
                  parentId: reply?.id ?? null,
                }),
              )
            ) {
              setBody("");
              setReply(null);
              setRequest(null);
            }
          }}
        >
          <fieldset disabled={busy}>
            {reply && (
              <p>
                Replying to {reply.name || "removed comment"}{" "}
                <button
                  type="button"
                  className="button"
                  onClick={() => setReply(null)}
                >
                  Cancel reply
                </button>
              </p>
            )}
            <label htmlFor={`comment-name-${postId}`}>Your name</label>
            <input
              id={`comment-name-${postId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoComplete="nickname"
            />
            <label htmlFor={`comment-body-${postId}`}>
              {reply ? "Your reply" : "Your comment"}
            </label>
            <textarea
              id={`comment-body-${postId}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={3000}
              rows={4}
              required
            />
            <button type="submit" className="button button-primary">
              {busy ? "Sending…" : reply ? "Post reply" : "Post comment"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
