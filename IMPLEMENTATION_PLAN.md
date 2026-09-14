# Galaxy Wars progress blog

Historical plan for the initial implementation. Current save behavior is described in [docs/plans/save-to-public-flow.md](docs/plans/save-to-public-flow.md); draft and publication controls have been removed.
Date: 2026-09-10

## Goal

Create a very simple public development blog for Galaxy Wars. Each change gets a compact write-up with exactly two description paragraphs, a before screenshot, an after screenshot, and an optional YouTube link. As requested after the initial implementation, entries published on the same day share one public page. The owner adds and edits individual entries through a password-protected URL. Readers need no account or password.

Use the visual language and deployment approach of the sibling `C:\Projects\trading-journal` project. Implementation was authorized after the initial planning session. Deployment is a separate step.

Implementation notes: screenshot rows can be staged privately before attachment, with a partial unique constraint allowing only one active image per post/role. A post version counter prevents stale saves from overwriting another tab's changes. These support the planned explicit-save behavior without introducing a revision system. See [README.md](README.md) for setup and [docs/validation.md](docs/validation.md) for verification evidence.

## Reference findings

Inspected the sibling checkout, rather than assuming its planned features already exist:

- `src/app/globals.css`: charcoal background (`#0f1110`), green-tinted panels, lime accent (`#d0ff71`), pale text (`#eef5f1`), muted green-gray text (`#93a49d`), subtle borders, rounded panels and pill buttons. Typography uses IBM Plex Sans with Segoe UI and sans-serif fallbacks.
- `src/components/JournalApp.tsx`: a sidebar and main content layout, small uppercase section labels, restrained metadata, generous spacing.
- `package.json`: one Next.js application with TypeScript, React, PostgreSQL, Drizzle, and Zod.
- `docs/decisions/0001-screenshot-storage.md`: private Railway S3-compatible storage for screenshots; PostgreSQL for metadata; ordinary multipart uploads through the application.
- `docs/decisions/0003-postgresql-persistence.md`: PostgreSQL with committed Drizzle migrations.
- `docs/decisions/0004-authentication-boundary.md`: public reads and authenticated mutations, secure HTTP-only sessions, and login rate limiting. The inspected checkout documents this boundary but does not implement a password login flow.

Reuse these conventions selectively. Do not copy trading features, sample data, or its broad milestone backlog. No changes to the sibling project are needed.

## Reader experience

### Public index: `/`

- Galaxy Wars branding, a short introduction, and a chronological list of publication days, newest first.
- Each day has one card showing its date, entry count, up to three entry titles, and the latest entry's after screenshot. The whole card links to the daily page.
- Show 12 whole days per page with ordinary older/newer navigation; no search, filters, or infinite scroll in the initial version.
- A useful empty state appears until the first real post is published. Do not ship fabricated game progress as real content.

### Public daily page: `/days/YYYY-MM-DD`

1. Link back to all days, one date heading, and the published entry count.
2. For multiple entries, a short list of links to each entry's section.
3. Each entry in first-publication order: its title, two paragraphs, equal-sized **Before** and **After** screenshot areas, and optional **Watch on YouTube** link.
4. Each entry has a stable anchor. Existing `/updates/[slug]` URLs redirect to its section on the daily page.

Use a centered reading column, with a wider screenshot row. Place screenshots side by side on desktop and stack Before above After on mobile. Preserve the entire image with its native aspect ratio; never crop away HUD or gameplay evidence. Clicking an image opens its full-resolution version. Reserve image space using stored dimensions to avoid layout jumps.

The daily page scrolls as needed, especially on mobile. Each entry retains its original content structure; grouping does not merge paragraphs, screenshots, or video links across entries.

Use semantic server-rendered HTML, page-specific titles/descriptions, and share metadata referencing the after screenshot. Public content and image URLs must work without login. Keep administration out of public navigation and exclude admin pages from indexing; the URL's obscurity is not the security mechanism.

## Owner experience

### Routes

| Route                    | Purpose                                               | Access            |
| ------------------------ | ----------------------------------------------------- | ----------------- |
| `/admin/login`           | Password entry                                        | Public login form |
| `/admin`                 | List posts with draft/published labels and edit links | Owner session     |
| `/admin/new`             | Create a post                                         | Owner session     |
| `/admin/posts/[id]/edit` | Edit, preview, publish, or unpublish                  | Owner session     |

Unauthenticated admin navigation redirects to login. Login returns to a validated local admin path; do not accept arbitrary redirect destinations.

### Minimal editor

- Title: required on publication, maximum 120 characters.
- Paragraph one and paragraph two: separate plain-text fields, each required on publication, maximum 1,500 characters each. Each field represents one paragraph; normalize pasted line breaks to spaces. No rich-text or Markdown editor.
- Before and after: two labeled image file pickers with local previews and replace controls; both required on publication. File pickers are sufficient for the first version.
- Short alt text for each image, required on publication, maximum 200 characters.
- YouTube URL: optional. Accept HTTPS links for a single video on `youtube.com`, `www.youtube.com`, `m.youtube.com`, or `youtu.be`, including watch, shorts, and share forms. Parse and store a validated video ID; render a canonical link. Reject arbitrary hosts, unsupported paths, and playlist-only URLs. No iframe or video upload in the initial version.
- Actions: **Save draft**, **Preview**, **Publish** (or **Save changes** for published posts), and **Unpublish**. Show a clear save result and link to the public page after publishing.

Preview uses the same post component as the public page, within the authenticated editor. It can preview current unsaved form values. No public preview token or separate preview service is needed.

Drafts can be incomplete and are visible only to the owner. Publishing requires every mandatory field and both successfully stored screenshots. Publishing is explicit, so incomplete material cannot accidentally appear publicly. Editing a published post updates the public version only after a successful explicit save; warn about unsaved changes on navigation. No autosave, revisions, scheduling, or parallel draft version of a published post.

Generate a readable slug from the title on first publication and add a short unique suffix on collision. Keep it stable through later title changes and unpublish/republish cycles. Set publication time on first publish and preserve it afterward. Slugs and draft IDs are never authorization mechanisms.

Also persist a publication day using `BLOG_TIME_ZONE` (default `America/Chicago`). This includes daylight-saving boundaries. Editing, republishing, and later timezone configuration changes preserve the assigned day. Migration `0001` backfills existing publication timestamps in the default Chicago timezone.

Unpublish removes that entry and its screenshots from public delivery while retaining them in the editor. Other published entries keep the daily page available. Unpublishing the last entry removes its day from the index and makes that day URL return 404. Previously downloaded or externally cached copies cannot be recalled. Permanent post deletion is deferred; unpublishing is sufficient for the first release.

## Application and persistence

Use one Next.js App Router application in TypeScript, with React, PostgreSQL, Drizzle migrations, Zod input validation, and a small S3 storage adapter. Select supported package versions and commit a lockfile at implementation time; do not blindly copy version numbers from the reference checkout.

Keep server components, actions, and upload handlers thin. Put post validation, publication rules, and persistence orchestration in small server modules that can be tested directly. Authenticate every mutation, including draft creation, upload/replacement, publication, unpublication, and logout. Avoid a generic CMS, separate API service, elaborate repository framework, or extra worker for this scope.

### Minimal records

| Record            | Fields and constraints                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `posts`           | UUID, nullable unique slug until first publish, title, two paragraphs, optional YouTube video ID, draft/published status, first publication time, persisted publication day, created/updated times |
| `post_images`     | UUID, post foreign key, before/after role, unique immutable object key, MIME type, width, height, byte size, alt text; unique `(post_id, role)`                                                    |
| `admin_sessions`  | Hashed random session token, expiry, credential-version fingerprint, created time                                                                                                                  |
| `login_attempts`  | Bounded persistent rate-limit counters/window timestamps; hashed client identifier                                                                                                                 |
| `storage_cleanup` | Unreferenced object keys awaiting deletion, timestamps and retry information                                                                                                                       |

The session and rate-limit records avoid another production service and continue to work across restarts. Cleanup records cover the database/object-store transaction boundary without requiring a queue platform.

Store text and image metadata in PostgreSQL, binaries in a private Railway bucket. Never persist uploads on the application container filesystem, store image binaries in PostgreSQL, or save temporary signed URLs as permanent references.

### Screenshot handling

- Accept PNG, JPEG, and WebP, up to 10 MiB per file and 32 megapixels after decoding. Reject SVG, animated images, mismatched content, and invalid or oversized images server-side. Bound the request body as well as decoded dimensions.
- Upload each role independently so two files do not require one large request. Show progress/failure and preserve entered text after errors.
- Require an authenticated owner and an existing post. Generate random immutable object keys; never derive storage paths from user filenames.
- Preserve original resolution. Serve originals initially, lazy-load index thumbnails, and measure actual load performance before adding generated variants.
- On replacement, store and validate the new object before swapping its database reference in a transaction. If anything fails, retain the old image. Record pending objects durably before storage writes so interrupted uploads can be reconciled.
- Queue replaced/unattached objects for cleanup. Supply an idempotent maintenance command with a grace period for in-flight uploads, and document invoking it operationally; do not require a continuously running worker. Cleanup failure must not break a successful post save.
- Deliver media through a stable app route such as `/media/[imageId]`. Check whether its owning post is published or the request has a valid owner session; never accept arbitrary bucket keys from callers. Use private/no-store caching initially so unpublishing is effective at the application boundary.
- Query public post DTOs explicitly; do not expose sessions, credentials, storage keys, or drafts in HTML, API results, metadata, or page caches.

## Password protection

One owner password, no usernames, account registration, email, password-reset emails, OAuth, or user-management screen.

- Configure a salted scrypt password hash through a server-only `ADMIN_PASSWORD_HASH` environment variable. Provide a local hidden-input command to generate it; do not place plaintext passwords in committed files or browser bundles.
- Verify the password server-side and issue a cryptographically random opaque session token. Store only its hash in PostgreSQL.
- Use an HTTP-only, Secure-in-production, SameSite=Lax cookie with a seven-day absolute expiry. Rotate the token on login, revoke it on logout, and invalidate existing sessions when the configured password hash changes.
- Rate-limit failed login attempts using atomic PostgreSQL counters: initial default five failures per client per 15 minutes, plus a broader service-level ceiling. Verify Railway proxy handling before trusting client IP headers; return generic errors and bounded retry feedback.
- Check same-origin requests for mutations, including login and uploads, and retain framework CSRF protections for server actions. Validate any configured public origin exactly.
- Fail closed if the password configuration is missing or invalid. Public reading remains available, but owner login cannot succeed.

## Railway and local development

Match the sibling's intended setup: one application service, one PostgreSQL service, and one private Railway Storage Bucket. Use separate credentials/resources for this blog; do not share the trading journal's database or content bucket implicitly.

Railway's current documentation supports deploying Next.js with PostgreSQL and S3-compatible bucket access:

- [Deploy a Next.js App with Postgres](https://docs.railway.com/guides/nextjs)
- [Use Storage Buckets](https://docs.railway.com/guides/storage-buckets-guide)

Implementation deliverables:

- `.env.example` containing placeholders for `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `APP_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- Local Docker Compose with PostgreSQL and an S3-compatible store, including bucket initialization.
- Scripts for development, build, production start, migrations, password-hash generation, cleanup, type checking, linting, and tests.
- Committed Railway configuration: application build, migration pre-deploy command, production start using Railway's assigned port, and `/api/health` health check. Builds must not require access to live production data or production secrets.
- Health check verifies database readiness and returns no secrets. Verify bucket access as a separate deployment smoke check.
- README with local setup, Railway resource/variable wiring, owner URL, password rotation, backup/restore, and troubleshooting steps.
- Back up both PostgreSQL and bucket objects; document how to restore matching metadata and images. A redeploy is not a backup.

Actual provisioning, domain selection, and deployment occur when requested. No production resources or credentials are needed to complete this plan.

## Implementation sequence and gates

1. **Foundation and appearance.** Scaffold the application, local services, schema/migrations, and public layout using the reference palette and components. Build index, one-pager, and empty/404 states. Use clearly labeled test fixtures only during development. Gate: fresh migrations, type/lint checks, production build, and desktop/mobile layout review.
2. **Owner session and authoring.** Implement password setup/login/logout, protected routes and mutations, rate limits, draft editor, validation, and authenticated preview. Gate: anonymous direct mutation attempts fail, valid sessions work, tampered/expired/revoked sessions fail, drafts stay private, and login rate limits persist through restart.
3. **Screenshots and publication.** Implement validated uploads/replacements, storage cleanup, publication rules, public media delivery, index pagination, stable post links, and optional YouTube links. Gate: owner can create and publish a complete post; an anonymous browser can read its two paragraphs and both full-resolution images; failure paths preserve existing content.
4. **Railway readiness and acceptance.** Complete deployment configuration and operating documentation. Exercise production build/start and restart persistence locally. After deployment is requested, run a Railway smoke test including a redeploy and anonymous reading of the saved post.

Complete and review each slice before broadening the feature set. Do not treat documentation or a passing build as evidence that the authoring and reader flows work.

## Acceptance checklist

- [x] Public homepage and a direct post URL work in an incognito browser without login.
- [x] Owner can log in at the special URL, save a draft, preview it, publish it, edit it, and unpublish it.
- [x] Published posts contain exactly two paragraphs and two correctly labeled screenshots; incomplete publication is rejected server-side.
- [x] Draft text and images cannot be retrieved anonymously, including by guessed IDs or metadata routes.
- [x] Both images remain readable and uncropped at desktop and mobile widths; keyboard focus, labels, contrast, alt text, and errors were inspected.
- [x] Optional valid YouTube link works; leaving it empty adds no empty video area; invalid hosts and script URLs fail validation.
- [x] Upload size/type/decode failures and storage/database failures are covered; interrupted browser uploads retain the previous screenshot and entered text.
- [x] Login, logout, password rotation, cookie expiry/tampering, rate limiting, and cross-origin mutation rejection are covered by meaningful tests.
- [x] PostgreSQL/storage integration tests cover publication, unique slugs/roles, replacement, unpublishing, and cleanup retries.
- [x] A browser acceptance test covers login, draft, both uploads, preview, publish, anonymous read, edit, and unpublish.
- [x] Actual rendered captures inspected at 1440px desktop and 390px mobile, using the game's September 8 ammunition-market screenshot pair. This is implementation visual review; the owner can still assess the design.
- [x] Posts and screenshots survive fresh application processes and a stop/start cycle.
- [ ] After Railway deployment, verify posts and screenshots survive redeployment there.
- [x] Local setup, lockfile installation, and production build pass with the documented commands.

## Out of scope

Comments, reactions, public accounts, subscriptions, analytics dashboards, tags/search, rich text, additional screenshot galleries, comparison sliders, hosted video, YouTube embeds, automatic imports from the game repository, AI-generated posts, scheduled publication, version history, and a multi-user CMS.

The planned defaults are `/admin`, one password, explicit draft/publication controls, and an ordinary YouTube link. They can be adjusted during plan review without changing the core architecture.
