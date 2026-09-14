# Save-to-public entry flow

Status: implemented and locally validated. This replaces the earlier compatibility proposal at the user's request.

## Final scope

- Save valid entries publicly in one operation; edit live entries through both editor and the existing v1 API.
- Remove draft, preview, publish and unpublish code and controls. No v2 or old publication compatibility layer.
- Make all existing records public through migration 0005, even incomplete drafts, preserving their exact content and selected images. Missing slugs/timestamps/dates receive metadata only; no invented content.
- Remove the published database column, constraint and filtered index. Preserve publishedAt and publishedDay as first-save and editable calendar metadata.
- Upload images before an entry exists. Keep unattached uploads private, claim them atomically on save, and retain cleanup/retry safety.
- Opening a new editor creates no database record. Save entry creates one; Save changes updates it. Existing comments and polls retain their entry IDs.
- Keep version conflict checks, authentication, request correlation and durable idempotency. Old receipt keys cannot replay obsolete draft responses.
- Update authenticated help and documentation to the current contract. No deployment or push without explicit request.

## Validation

Test public creation/live edits, empty/new form validation, dates and ordering, multiple images/videos, owner access, stale/concurrent saves, retry receipts, cross-entry image claims, cleanup races, migration of incomplete records and existing links, comments/polls, and desktop/mobile browser behavior. Run typecheck, lint, unit/integration tests, production build, browser checks and formatting before committing.
