import Link from "next/link";
import { ownerPage } from "@/server/http";
import { newPost } from "../actions";
export const dynamic = "force-dynamic";
export default async function NewPost() {
  await ownerPage("/admin/new");
  return (
    <section className="login-panel panel">
      <p className="eyebrow">A new field note</p>
      <h1>What’s changed?</h1>
      <p className="lede">
        Start a private draft. Nothing appears on the public log until you
        publish.
      </p>
      <form action={newPost}>
        <button className="button button-primary">Start writing →</button>
      </form>
      <Link className="back-link" href="/admin">
        ← Your updates
      </Link>
    </section>
  );
}
