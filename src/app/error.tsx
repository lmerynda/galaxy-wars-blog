"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="hud-panel empty-state">
      <p className="panel-title">Signal lost</p>
      <h1>This page didn’t load</h1>
      <p>The server didn’t answer. Try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
