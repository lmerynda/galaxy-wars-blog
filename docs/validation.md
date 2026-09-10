# Local validation — September 10, 2026

Implemented the agreed blog scope in a single Next.js application. No Railway resources were created and no real posts were published to an external site. The development database starts empty.

## Checks

| Check                   | Result                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency installation | `npm ci` succeeds with the committed lockfile                                                                                          |
| Static checks           | ESLint and strict TypeScript pass                                                                                                      |
| Unit tests              | 15 passing: publication inputs, video links, password hashes, origin/redirect validation, image format/decode/size/animation rejection |
| Integration tests       | 7 passing against real local PostgreSQL and MinIO                                                                                      |
| Production build        | Next.js production build succeeds, including with an unreachable database URL                                                          |
| Browser acceptance      | Full owner/anonymous flow passes in headless Microsoft Edge against the production build                                               |
| Restart persistence     | Separate application process started, stopped, and started again; public post and full image bytes remain available                    |
| Dependency audit        | 0 reported vulnerabilities                                                                                                             |
| Formatting              | Prettier check passes                                                                                                                  |

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

## Deployment work remaining

The owner still needs to choose a production password, provision Railway PostgreSQL and a private bucket, set the service variables/domain, and deploy. Then perform the health, storage, anonymous-reading, and redeploy smoke checks documented in the README. Backup restoration instructions are provided; an actual production backup/restore drill has not been performed.
