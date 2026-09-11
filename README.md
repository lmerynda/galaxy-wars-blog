# Galaxy Wars development log

A public blog for small, visual updates to Galaxy Wars, grouped into one page per day. Every entry has two paragraphs, an ordered image gallery, and an optional YouTube link. A password-protected owner studio lives at `/admin`.

The application follows the charcoal/lime styling and single Next.js/PostgreSQL/Railway bucket setup of the sibling Trading Journal project. It starts empty; test posts are never inserted into the development or production database.

## Local setup

Requires Node.js 24 and Docker Compose.

```sh
npm ci
cp .env.example .env
npm run password:hash
```

On PowerShell, use `Copy-Item .env.example .env` for the copy step. The password command takes hidden input and prints an `ADMIN_PASSWORD_HASH` assignment. Paste that assignment into `.env`. Keep the hash private. The format uses colons so Next.js environment-variable expansion does not alter it.

```sh
npm run dev:all
```

Open [the public blog](http://localhost:3000) or [the owner studio](http://localhost:3000/admin). There is no default owner password. An absent or malformed hash disables sign-in while public reads remain available.

The local PostgreSQL service uses port **5548**, the private object store uses **9018**, and its console uses **9019**. Compose uses dedicated `galaxy-wars-blog` resources and persistent named volumes. These services do not reuse the trading journal's database or storage.

To run individual steps:

```sh
npm run services
npm run db:migrate
npm run dev
```

`docker compose stop` stops the blog's containers while retaining data. Do not use `down -v` unless you intend to erase local posts and images.

## Writing an update

1. Open `/admin` and sign in. Choose **New update**, then **Start writing**.
2. Add a title and two short paragraphs: the original problem, then the change and its effect on players.
3. Add any number of images, describe each one, and arrange them with **Move up**. **Remove** excludes an image on the next save. Uploads accept still PNG, JPEG, or WebP files up to 10 MiB and 32 megapixels each.
4. Optionally paste an HTTPS YouTube video link. This appears as an external link, without an embedded player.
5. **Save draft** to keep work private; **Preview update** to inspect the current form; **Publish update** when ready.

Uploaded replacements stay private until a successful save. The editor retains entered text on errors, warns when leaving with unsaved edits, and prevents stale edits from another tab overwriting a newer save. Unsaved uploads expire after a 24-hour cleanup grace period; save a draft to retain them.

Entries published on the same calendar day appear together at `/days/YYYY-MM-DD`. The homepage shows one card per day, with the entry count, up to three entry titles, and the latest entry's last gallery image. Pagination counts 12 whole days, so it never splits a day across pages. On the daily page, entries appear oldest first, each with its own text, gallery, optional video, and linkable section.

Days use `BLOG_TIME_ZONE` (default `America/Chicago`), including daylight-saving changes. The day is saved at **first publication**, not draft creation. Later editing, unpublishing/republishing, or timezone configuration changes do not move an existing entry to a different day. There is no extra daily-page editing step: publish each entry normally and it joins its day's page automatically.

The editor's public link opens the entry's section on its daily page. Existing `/updates/[slug]` links redirect there as well. Changing a title preserves those links and the original publication date. **Unpublish** hides just that entry and its images; the daily page stays public if it has other published entries. A day disappears from the homepage and returns 404 when its last entry is unpublished. Previously downloaded or externally cached copies cannot be recalled. Permanent post deletion is intentionally omitted.

Migration `0001` backfills existing entries (including previously published drafts) using their original publication timestamp in `America/Chicago`. Fresh drafts remain unassigned until publication. Run migrations before starting the updated application; Railway's pre-deploy migration command handles this automatically.

## Railway deployment

Create one Railway project with three resources:

- A service deployed from this repository, using Node.js 24.
- PostgreSQL, dedicated to this blog.
- A private Railway Storage Bucket, dedicated to this blog.

Configure the app service in Railway Settings: build `npm run build`, pre-deploy `npm run db:migrate`, start `npm start`, and health check `/api/health`. The checked-in `railway.json` records these values for legacy services, but new Railway services no longer accept that configuration format as of August 28, 2026; do not rely on automatic discovery. The production service was configured directly in the Railway UI. `next start` reads Railway's `PORT`. The runtime migration/maintenance dependency `tsx` is a production dependency, so commands also work when development packages are pruned.

For AI-assisted draft creation, screenshot uploads and explicit publishing, see [Publishing API](docs/publishing-api.md). Set the optional `BLOG_API_TOKEN` secret on the app service to enable it; it is independent of the owner password.

Set these **application service** variables using Railway resource references where possible:

| Variable               | Value                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Railway PostgreSQL connection string, preferably private networking                                 |
| `APP_URL`              | Exact public HTTPS origin, such as `https://your-blog.up.railway.app`; update when changing domains |
| `BLOG_TIME_ZONE`       | IANA timezone for new entries' publication days; defaults to `America/Chicago`                      |
| `ADMIN_PASSWORD_HASH`  | Value generated by `npm run password:hash`, without surrounding shell quotes                        |
| `S3_ENDPOINT`          | Bucket's S3 endpoint                                                                                |
| `S3_REGION`            | Bucket's region                                                                                     |
| `S3_BUCKET`            | Bucket name                                                                                         |
| `S3_ACCESS_KEY_ID`     | Bucket access key                                                                                   |
| `S3_SECRET_ACCESS_KEY` | Bucket secret key                                                                                   |
| `S3_FORCE_PATH_STYLE`  | `false` for Railway; `true` for the local MinIO service                                             |
| `TRUST_RAILWAY_PROXY`  | `true` only when all public requests arrive through Railway's edge                                  |

Railway documents `X-Real-IP` as its client IP header. The application uses it only with explicit proxy trust; otherwise sign-in attempts share a conservative client limit. Check that spoofed headers are overwritten at your deployed edge before enabling trust. Rate limits and session tokens persist in PostgreSQL across restarts. Five attempts per client per 15 minutes and a 100-attempt service ceiling bound password verification; successful sign-in clears the client counter.

Password hashes and all storage credentials stay server-side. Session cookies are HTTP-only, SameSite=Lax, and Secure in production, with seven-day absolute expiry. Restart/redeploy after replacing `ADMIN_PASSWORD_HASH`; sessions created with the previous hash become invalid. Mutations require the configured origin and an owner session.

After deployment:

1. Confirm `/api/health` returns `{"status":"ok"}`.
2. Run `npm run storage:check` in the deployed service context to verify bucket access.
3. Sign in at `/admin`, publish a post, and open its URL and both images in an incognito browser.
4. Redeploy the application and verify the same post and images are still available.

The application stores no persistent data on its container filesystem. Public media is delivered through app routes with `private, no-store` caching to enforce unpublishing. This favors simple access rules over CDN efficiency; revisit display variants and caching only if actual image traffic warrants it. Original images remain uncropped and available at full resolution.

Railway resources and domains have not been provisioned by this implementation. See [Railway's Next.js guide](https://docs.railway.com/guides/nextjs), [bucket guide](https://docs.railway.com/guides/storage-buckets-guide), and [network header reference](https://docs.railway.com/networking/public-networking/specs-and-limits).

## Storage maintenance and backups

Run `npm run storage:cleanup` periodically in the service's environment (for example, weekly as an operator command). It processes up to 100 queued objects per invocation. Repeat when a large backlog exists. No separate worker or scheduled job is required for the initial deployment.

Uploads get durable cleanup markers before object creation. A successful post save attaches the selected images and cancels their markers. Replaced images and abandoned uploads become eligible after 24 hours. Cleanup locks and rechecks each marker before deleting; active images are retained. A failed delete is retried no sooner than one hour later. Commands exit unsuccessfully when any deletion fails, without affecting published content.

Back up **both** PostgreSQL and the bucket. For a simple consistent backup:

1. Pause owner writes and cleanup while readers continue browsing.
2. Export PostgreSQL with `pg_dump` in custom format and copy the bucket with an S3-compatible tool, preserving object keys.
3. Verify the dump can be read and the copied objects' counts/sizes match; keep dated copies outside the running resources.
4. Resume authoring and maintenance.

Restore into a separate PostgreSQL database and private bucket first. Restore the dump with `pg_restore`, copy objects under the same keys, point a staging application at both, apply any newer committed migrations, and verify representative public and draft pages/images. Use a new owner password hash to revoke restored sessions. Switch the production configuration only after this check. Never restore only the database and assume screenshots are included.

## Checks

```sh
npm run check
npm run format:check
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Integration and browser tests require `npm run services`. They create separate `galaxy_wars_blog_test` and `galaxy_wars_blog_e2e` databases on the dedicated local PostgreSQL port; test setup refuses other hosts/ports and resets only those named test databases. Never point tests at a production service.

Browser tests start their own production server on **3018**, use an explicitly test-only password, and exercise login, drafting, publication, screenshot access, editing, and unpublishing. They write ignored captures to `artifacts/visual` and failure traces to `test-results`. Set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser. Tests use generated image fixtures by default. To review real game imagery, set `E2E_BEFORE_IMAGE` and `E2E_AFTER_IMAGE` to local PNG screenshot paths before running the browser suite.

The esbuild override keeps Drizzle's legacy development loader on a patched compiler; schema generation and tests verify the override. Reassess it when updating Drizzle. Do not expose a Drizzle studio or development server publicly.

## Code map

- `src/app`: server-rendered public pages, owner routes, server actions, upload/media/health handlers.
- `src/components`: shared reader view, editor, and login form.
- `src/lib/post.ts`: content types and input/YouTube validation.
- `src/server`: authentication, PostgreSQL queries, image validation/storage, and transactional publication.
- `drizzle`: schema snapshots and ordered SQL migrations. Generate changes with `npm run db:generate` and review the SQL before deployment.
- `tests`: unit, PostgreSQL/S3 integration, and browser acceptance tests.

The original scope and acceptance gates are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Comments and design polls

Each published entry has guest comments with nested replies. Visitors enter a display name; no account is required. The owner studio can hide and restore comments, preserving their replies. Hidden comment text and names are not sent to readers. Draft discussions are private. Comments are limited to 3,000 characters and ten submissions per 15 minutes per trusted client IP (shared limit when proxy trust is disabled).

The entry editor can create an optional poll with a question and 2–12 labeled choices, such as Proposal A and Proposal B matching gallery captions. Readers see live totals after each vote and can change their choice. An HTTP-only browser cookie identifies a voter; clearing cookies or using another browser permits another vote, so this is informal feedback, not verified one-person voting. No third-party account or tracking service is used. Poll questions and choices are fixed once votes exist; owners can close or reopen voting. Poll settings save separately from entry text, and polls on drafts remain private until publication.

Migration `0003` adds gallery ordering, comments and polls, preserves before/after ordering for existing entries, and removes the two-image database restriction. Run it through the existing Railway pre-deploy migration step before starting this version.
