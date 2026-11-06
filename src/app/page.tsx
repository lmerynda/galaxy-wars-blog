import Link from "next/link";
import { publicDays } from "@/server/posts";
import { dayUrl, formatDay } from "@/lib/day";
export const dynamic = "force-dynamic";

const updates = (n: number) => `${n} ${n === 1 ? "update" : "updates"}`;
const shortDay = (day: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = (await searchParams).page;
  const page =
    raw && /^\d+$/.test(raw) ? Math.max(1, Math.min(100000, Number(raw))) : 1;
  const { days, hasMore } = await publicDays(page);
  const latest = days[0];
  return (
    <>
      <section className="hud-panel home-hero">
        <p className="panel-title">Flight log</p>
        <h1>Galaxy Wars development</h1>
        <p className="lede">
          Screenshots and short notes from building Galaxy Wars, a space combat
          game. New entries land here the day the change does.
        </p>
        {latest && page === 1 && (
          <dl className="readout">
            <div>
              <dt>Latest entry</dt>
              <dd>{shortDay(latest.day)}</dd>
            </div>
            <div>
              <dt>That day</dt>
              <dd>{updates(latest.count)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="ready">In development</dd>
            </div>
          </dl>
        )}
      </section>
      {days.length ? (
        <ol className="mission-grid" aria-label="Days">
          {days.map((day) => (
            <li key={day.day}>
              <Link className="hud-panel mission" href={dayUrl(day.day)}>
                <span className="panel-title mission-title">
                  <time dateTime={day.day}>{formatDay(day.day)}</time>
                  <span className="ready">{updates(day.count)}</span>
                </span>
                {day.image && (
                  <span className="lock">
                    <img
                      src={day.image.url}
                      width={day.image.width}
                      height={day.image.height}
                      alt=""
                      loading="lazy"
                    />
                  </span>
                )}
                <ul className="mission-titles">
                  {day.titles.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                  {day.count > day.titles.length && (
                    <li className="muted">
                      and {day.count - day.titles.length} more
                    </li>
                  )}
                </ul>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="hud-panel empty-state">
          <p className="panel-title">
            {page === 1 ? "No entries yet" : "End of the log"}
          </p>
          <p>
            {page === 1
              ? "The first development update will appear here."
              : "There are no older days."}
          </p>
          {page > 1 && (
            <Link className="button" href="/">
              Back to the latest days
            </Link>
          )}
        </div>
      )}
      {(page > 1 || hasMore) && (
        <nav className="pagination" aria-label="Older and newer days">
          {page > 1 ? (
            <Link className="button" href={`/?page=${page - 1}`}>
              Newer days
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">Page {page}</span>
          {hasMore ? (
            <Link className="button" href={`/?page=${page + 1}`}>
              Older days
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
