// Temporary: UI concept exploration. The chosen concept moves into the real pages; the rest is deleted.
import Link from "next/link";
import { dayUrl, formatDay } from "@/lib/day";
import { schematicFor, sectorFor, type Concept } from "@/lib/concepts";
import type { publicDays } from "@/server/posts";
import type { Post } from "@/lib/post";

type HomeDay = Awaited<ReturnType<typeof publicDays>>["days"][number];
type HomeProps = { days: HomeDay[]; page: number; hasMore: boolean };

const updates = (n: number) => `${n} ${n === 1 ? "update" : "updates"}`;
const short = (day: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const lede =
  "Screenshots and short notes from building Galaxy Wars, a space combat game. New entries land here the day the change does.";

function Pager({ page, hasMore }: { page: number; hasMore: boolean }) {
  if (page === 1 && !hasMore) return null;
  return (
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
  );
}

function Empty() {
  return (
    <p className="concept-empty">
      No entries yet. The first update will appear here.
    </p>
  );
}

function Titles({ day }: { day: HomeDay }) {
  return (
    <ul className="concept-titles">
      {day.titles.map((title, i) => (
        <li key={i}>{title}</li>
      ))}
      {day.count > day.titles.length && (
        <li className="concept-more">
          and {day.count - day.titles.length} more
        </li>
      )}
    </ul>
  );
}

function SectorHome({ days, page, hasMore }: HomeProps) {
  const here = days[0] ? sectorFor(days[0].day) : undefined;
  return (
    <div className="sector-home" data-sector={here?.id}>
      <section className="sector-hero">
        {here && (
          <p className="sector-now">
            Latest jump: <strong>{here.name}</strong>
          </p>
        )}
        <h1>Every day, a little further out.</h1>
        <p className="lede">{lede}</p>
      </section>
      {days.length ? (
        <ol className="route" aria-label="Days">
          {days.map((day) => {
            const sector = sectorFor(day.day);
            return (
              <li key={day.day} className="waypoint" data-sector={sector.id}>
                <Link href={dayUrl(day.day)}>
                  <span className="waypoint-node" aria-hidden="true" />
                  <span className="waypoint-head">
                    <time dateTime={day.day}>{formatDay(day.day)}</time>
                    <span className="waypoint-sector">{sector.name}</span>
                    <span className="waypoint-count">{updates(day.count)}</span>
                  </span>
                  <Titles day={day} />
                  {day.images.length > 0 && (
                    <span className="waypoint-strip">
                      {day.images.map((image) => (
                        <img
                          key={image.id}
                          src={image.url}
                          width={image.width}
                          height={image.height}
                          alt=""
                          loading="lazy"
                        />
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty />
      )}
      <Pager page={page} hasMore={hasMore} />
    </div>
  );
}

function HudHome({ days, page, hasMore }: HomeProps) {
  const latest = days[0];
  return (
    <div className="hud-home">
      <section className="hud-panel hud-hero">
        <p className="hud-panel-title">Flight log</p>
        <h1>Galaxy Wars development</h1>
        <p className="lede">{lede}</p>
        {latest && (
          <dl className="hud-readout">
            <div>
              <dt>Latest entry</dt>
              <dd>{short(latest.day)}</dd>
            </div>
            <div>
              <dt>That day</dt>
              <dd>{updates(latest.count)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="hud-ready">In development</dd>
            </div>
          </dl>
        )}
      </section>
      {days.length ? (
        <ol className="mission-grid" aria-label="Days">
          {days.map((day) => (
            <li key={day.day}>
              <Link className="hud-panel mission" href={dayUrl(day.day)}>
                <span className="hud-panel-title mission-title">
                  <time dateTime={day.day}>{formatDay(day.day)}</time>
                  <span className="hud-ready">{updates(day.count)}</span>
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
                <Titles day={day} />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Empty />
      )}
      <Pager page={page} hasMore={hasMore} />
    </div>
  );
}

function HangarHome({ days, page, hasMore }: HomeProps) {
  return (
    <div className="hangar-home">
      <section className="hangar-hero">
        <img
          className="hangar-hero-image"
          src="/game/hangar-bay.webp"
          srcSet="/game/hangar-bay-small.webp 960w, /game/hangar-bay.webp 1672w"
          sizes="100vw"
          width={1672}
          height={941}
          alt=""
        />
        <div className="hangar-hero-copy">
          <h1>Galaxy Wars development log</h1>
          <p className="lede">{lede}</p>
        </div>
      </section>
      {days.length ? (
        <ol className="bays" aria-label="Days">
          {days.map((day) => (
            <li key={day.day}>
              <Link className="bay" href={dayUrl(day.day)}>
                <img
                  className="bay-ship"
                  src={schematicFor(day.day)}
                  alt=""
                  width={520}
                  height={520}
                  loading="lazy"
                />
                <span className="bay-mark" aria-hidden="true">
                  {Number(day.day.slice(8, 10))}
                </span>
                <time className="bay-date" dateTime={day.day}>
                  {formatDay(day.day)}
                </time>
                <Titles day={day} />
                <span className="bay-foot">
                  <span>{updates(day.count)}</span>
                </span>
                {day.image && (
                  <img
                    className="bay-cover"
                    src={day.image.url}
                    width={day.image.width}
                    height={day.image.height}
                    alt=""
                    loading="lazy"
                  />
                )}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Empty />
      )}
      <Pager page={page} hasMore={hasMore} />
    </div>
  );
}

function TitleHome({ days, page, hasMore }: HomeProps) {
  const latest = days[0];
  return (
    <div className="title-home">
      {page === 1 && (
        <section className="title-screen">
          <div className="title-pan" aria-hidden="true" />
          <div className="title-logo">
            <h1>Galaxy Wars</h1>
            <p>Development log</p>
          </div>
          <nav className="title-menu" aria-label="Main menu">
            {latest && (
              <Link href={dayUrl(latest.day)}>
                Continue
                <span>{formatDay(latest.day)}</span>
              </Link>
            )}
            <a href="#days">
              Load a day<span>{days.length} on this page</span>
            </a>
            <Link href="/comments">
              Comments<span>Latest from players</span>
            </Link>
          </nav>
        </section>
      )}
      <section id="days" className="saves" aria-labelledby="days-title">
        <h2 id="days-title">Load a day</h2>
        {days.length ? (
          <ol>
            {days.map((day) => (
              <li key={day.day}>
                <Link className="save-slot" href={dayUrl(day.day)}>
                  {day.image ? (
                    <img
                      src={day.image.url}
                      width={day.image.width}
                      height={day.image.height}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="save-blank" />
                  )}
                  <span className="save-body">
                    <time dateTime={day.day}>{formatDay(day.day)}</time>
                    <span className="save-title">{day.titles[0]}</span>
                  </span>
                  <span className="save-count">{updates(day.count)}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </section>
      <Pager page={page} hasMore={hasMore} />
    </div>
  );
}

export function ConceptHome({
  concept,
  ...props
}: HomeProps & { concept: Exclude<Concept, "current"> }) {
  const Home = {
    sector: SectorHome,
    hud: HudHome,
    hangar: HangarHome,
    title: TitleHome,
  }[concept];
  return <Home {...props} />;
}

export function ConceptDayHeader({
  concept,
  day,
  posts,
}: {
  concept: Exclude<Concept, "current">;
  day: string;
  posts: Post[];
}) {
  const sector = sectorFor(day);
  const contents = posts.length > 1 && (
    <nav className="day-contents" aria-label="This day’s updates">
      {posts.map((post, index) => (
        <a href={`#entry-${post.id}`} key={post.id}>
          <span>{index + 1}</span>
          {post.title}
        </a>
      ))}
    </nav>
  );
  return (
    <header className={`day-header ${concept}-day-header`}>
      {concept === "sector" && (
        <p className="sector-now">
          Sector: <strong>{sector.name}</strong>
        </p>
      )}
      {concept === "hud" && <p className="hud-panel-title">Flight log entry</p>}
      {concept === "hangar" && (
        <span className="bay-mark" aria-hidden="true">
          {Number(day.slice(8, 10))}
        </span>
      )}
      <h1>
        <time dateTime={day}>{formatDay(day)}</time>
      </h1>
      <p className="lede">
        {updates(posts.length)}
        {concept === "title" ? " in this chapter." : " from this day."}
      </p>
      {contents}
    </header>
  );
}
