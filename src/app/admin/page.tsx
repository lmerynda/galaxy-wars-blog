import Link from "next/link";
import { ownerPage } from "@/server/http";
import { ownerPosts } from "@/server/posts";
import { signOut } from "./actions";
import { formatDate } from "@/lib/post";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const posts = await ownerPosts(await ownerPage());
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Owner studio</p>
          <h1>Your field notes.</h1>
          <p className="lede">Small stories from a galaxy in progress.</p>
        </div>
        <div className="actions">
          <form action={signOut}>
            <button className="button">Sign out</button>
          </form>
          <Link className="button button-primary" href="/admin/new">
            ＋ New update
          </Link>
        </div>
      </div>
      <div className="admin-list panel">
        <div className="section-heading">
          <h2>All updates</h2>
          <span className="muted">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </span>
        </div>
        {posts.length ? (
          posts.map((post) => (
            <Link
              className="admin-row"
              href={`/admin/posts/${post.id}/edit`}
              key={post.id}
            >
              <div>
                <span className={`badge ${post.published ? "badge-live" : ""}`}>
                  {post.published ? "Published" : "Draft"}
                </span>
                <h3>{post.title || "Untitled update"}</h3>
                <p className="muted">{formatDate(post.publishedDay)}</p>
              </div>
              <span className="muted">Edit →</span>
            </Link>
          ))
        ) : (
          <div className="admin-empty">
            <h3>Your next change starts here.</h3>
            <p className="muted">
              Add two paragraphs and a screenshot pair. Publish when you’re
              ready.
            </p>
            <Link className="button" href="/admin/new">
              Write the first update →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
