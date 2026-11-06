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
      <header className="hud-panel page-header admin-heading">
        <div>
          <p className="panel-title">Owner studio</p>
          <h1>Your updates</h1>
        </div>
        <div className="actions">
          <form action={signOut}>
            <button className="button">Sign out</button>
          </form>
          <Link className="button button-primary" href="/admin/new">
            New update
          </Link>
        </div>
      </header>
      <div className="hud-panel admin-list">
        <h2 className="panel-title admin-list-title">
          All updates
          <span className="ready">
            {posts.length} {posts.length === 1 ? "entry" : "entries"}
          </span>
        </h2>
        {posts.length ? (
          posts.map((post) => (
            <Link
              className="admin-row"
              href={`/admin/posts/${post.id}/edit`}
              key={post.id}
            >
              <div>
                <h3>{post.title || "Untitled update"}</h3>
                <p className="muted">{formatDate(post.publishedDay)}</p>
              </div>
              <span className="muted">Edit</span>
            </Link>
          ))
        ) : (
          <div className="admin-empty">
            <h3>No updates yet</h3>
            <p className="muted">
              Add two paragraphs and any images or videos. Saving publishes the
              update.
            </p>
            <Link className="button" href="/admin/new">
              Write the first update
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
