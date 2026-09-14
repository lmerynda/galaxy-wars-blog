import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state panel">
      <div>
        <p className="eyebrow">Signal not found · 404</p>
        <h1>This update is off the radar.</h1>
        <p>
          The link may be incorrect or this entry may have moved to another day.
        </p>
        <Link className="button button-primary" href="/">
          Back to the log
        </Link>
      </div>
    </section>
  );
}
