import Link from "next/link";
export default function NotFound() {
  return (
    <section className="hud-panel empty-state">
      <p className="panel-title">No signal</p>
      <h1>This page is off the radar</h1>
      <p>The link may be wrong, or the entry may have moved to another day.</p>
      <Link className="button" href="/">
        Back to the flight log
      </Link>
    </section>
  );
}
