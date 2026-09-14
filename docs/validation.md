# Save-to-public validation

The publication workflow has been removed from the application and existing v1 API. New saves are public immediately; image uploads can precede entry creation.

## Checks

- 31 unit tests: content, authentication helpers, dates/timezones, image decoding and diagnostics.
- 21 integration tests against the dedicated local PostgreSQL and MinIO services: public creation/live edits, dates and ordering, authentication and rate limits, multiple videos/images, version conflicts, duplicate saves, cross-entry image claims, cleanup races, storage/database failures, durable API receipts, pre-upgrade receipt rejection, authenticated help, comments and polls.
- Migration fixture converts complete and incomplete old records, preserving saved text, selected images, existing slugs and explicit dates; fills missing metadata in the configured timezone and removes the publication column.
- The actual migration runner succeeds against the dedicated local test database using a single session for timezone configuration and Drizzle migration execution.
- Production build, TypeScript, ESLint and formatting pass.
- Browser scenarios cover public first-save, upload privacy and origin/auth checks, multiple embedded videos, reload/restart persistence, live date changes, empty-form validation, new-editor visits creating no records, newest-first daily ordering, galleries, threaded comments, votes and moderation.
- Reviewed the editor capture at mobile width; desktop/mobile captures are written to artifacts/visual/save-entry-desktop.png and save-entry-mobile.png. Images in the tests are synthetic layout fixtures. YouTube playback is not part of this validation.

## Deployment boundary

No production data has been changed by this local implementation. Deployment must run migration 0005 with the new application. It makes all existing records public, including incomplete drafts, and removes publication state. Existing v1 clients must stop calling the removed publish/post-specific upload endpoints; current help documents POST /api/v1/images and immediate public POST/PUT saves. The old application cannot run after this schema change. No push is authorized by implementation alone.
