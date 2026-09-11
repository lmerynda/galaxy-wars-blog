# Local validation — September 10, 2026

Implemented the agreed blog scope in a single Next.js application. No Railway resources were created and no real posts were published to an external site. The development database starts empty.

## Checks

| Check                   | Result                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Dependency installation | `npm ci` succeeds with the committed lockfile                                                                                    |
| Static checks           | ESLint and strict TypeScript pass                                                                                                |
| Unit tests              | 29 passing: content/security/image validation plus calendar dates, timezones, midnight, daylight-saving boundaries, and day URLs |
| Integration tests       | 10 passing against real local PostgreSQL and MinIO, including grouping, whole-day pagination, and migration backfill             |
| Production build        | Next.js production build succeeds, including with an unreachable database URL                                                    |
| Browser acceptance      | 2 passing scenarios in headless Microsoft Edge: the owner/anonymous flow and multiple entries on one daily page                  |
| Restart persistence     | Separate application process started, stopped, and started again; public post and full image bytes remain available              |
| Dependency audit        | 0 reported vulnerabilities                                                                                                       |
| Formatting              | Prettier check passes                                                                                                            |

Integration tests cover unauthorized writes, private images, publication, staged replacement privacy, stable slugs/dates, concurrent slug allocation, stale saves, foreign-image rejection, injected storage and database failures, cleanup retries, persisted login limits, session expiry/logout, and password rotation.

The browser test covers incorrect/correct passwords, secure session cookie attributes, draft creation and saving, incomplete publication errors, both screenshot uploads, interrupted-upload recovery, private draft images, unauthorized and cross-origin upload requests, preview, publish, anonymous index/detail/media reads, optional video removal, edit, unpublish, and logout. It also checks the keyboard skip link and mobile overflow.

## Visual review

Reviewed the public index, post page, and editor at 1440px desktop and 390px mobile. The narrow homepage also has a 320px overflow check. Before/after frames have equal dimensions, retain the entire image with letterboxing when needed, and link to the original resolution. Mobile stacks the two frames in order.

Used real game captures from the sibling repository:

- `C:/Projects/galaxy-wars/docs/development/diary/images/ammunition-2026-09-08/before-human.png` — original 3440×1440 text-only market.
- `C:/Projects/galaxy-wars/docs/development/diary/images/ammunition-2026-09-08/Human-1280x720-top.png` — updated market with ammunition artwork and responsive controls.

Provenance: the game's `docs/development/diary/2026-09-08-ammunition-market.md`. The screenshots were used in the disposable browser-test database, not seeded into the development/production blog. The test's YouTube URL is a validation fixture, not game footage.

Generated captures are local, ignored artifacts:

- `artifacts/visual/home-empty-desktop.png`
- `artifacts/visual/home-desktop.png`
- `artifacts/visual/home-mobile.png`
- `artifacts/visual/post-desktop.png`
- `artifacts/visual/post-mobile.png`
- `artifacts/visual/editor-desktop.png`
- `artifacts/visual/editor-mobile.png`

Reproduce them with the environment variables and commands in the README. CI uses generated images unless real screenshot paths are supplied, and uploads its browser artifacts for inspection.

## Daily grouping follow-up

Entries now share `/days/YYYY-MM-DD` pages, assigned at first publication in `America/Chicago` by default. Verified that two entries produce one index card and one daily page, with their own titles, paragraphs, screenshot pairs, optional videos, and jump links. Existing entry URLs redirect to their daily-page anchors. Draft entries remain hidden, unpublishing one entry leaves the others visible, and unpublishing the final entry removes the day.

The PostgreSQL tests also verify persisted days across editing/republishing and timezone changes, chronological entry ordering, pagination by whole days, and migration of old published/unpublished entries across Chicago midnight. Unit tests cover winter/summer midnight, daylight-saving transitions, invalid dates, and leap years.

Reviewed `artifacts/visual/day-desktop.png` at 1440px and `artifacts/visual/day-mobile.png` at 390px, plus the one-card/two-entry index in `artifacts/visual/daily-home-desktop.png`. The two-entry browser fixture reuses the same real ammunition-market pair to test grouping; it is not two newly published game changes. The new migration was applied locally, and the production build passes.

## Railway deployment still pending

The owner still needs to choose a production password, provision Railway PostgreSQL and a private bucket, set the service variables/domain, and deploy. Then perform the health, storage, anonymous-reading, and redeploy smoke checks documented in the README. Backup restoration instructions are provided; an actual production backup/restore drill has not been performed.
