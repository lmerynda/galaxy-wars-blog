# Save-to-public entry flow

Status: planned; awaiting implementation approval.

## Outcome

Saving valid content creates or updates a public entry immediately. Remove the separate publishing workflow from the owner editor and the recommended API. Readers continue to see entries grouped by editable calendar date, newest first within each day. Keep optimistic version checks and durable idempotency receipts.

## Agreed behavior

- New entry opens an empty editor without inserting a post. One Save entry action creates the complete public entry. Save changes updates an existing entry immediately.
- Remove draft-save, preview, publish and unpublish controls from the normal editor. Keep unsaved-change navigation protection, upload progress, field validation and the public-page link.
- Require a title, both paragraphs and descriptions for every selected image on every save. Zero images and zero videos remain valid. Retain existing content and request-size limits, arbitrary ordered galleries and multiple embedded YouTube videos.
- Entry date remains editable, with the existing blank-date default/preservation behavior. Edits do not reset the original publication timestamp or move an entry to the top of its day. New entries receive a timestamp on first successful save.
- Existing private drafts are not automatically made public or deleted. Label them Private entry in the owner list. Opening them is read-only until the owner saves; show a concise notice that saving makes the entry public. Incomplete content must pass validation first.
- Preserve existing public posts, slugs, IDs, comments, polls, votes and media URLs. Poll configuration stays available after first save, once the entry has an ID.
- Deletion, archival, scheduling, revision history and autosave are outside this change. No additional confirmation step on ordinary saves.

## API contract and compatibility

Changing v1 POST from private draft creation to immediate public creation would silently change existing clients' behavior. Introduce v2 for the simplified contract; leave v1 working with its original semantics as a deprecated compatibility layer.

Recommended endpoints, all requiring the existing bearer API token:

| Endpoint               | Behavior                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET /api/v2/help       | Discover the save-to-public workflow, schemas, examples and capabilities.                                            |
| POST /api/v2/images    | Upload raw PNG/JPEG/WebP bytes before an entry exists; return an upload ID and image metadata.                       |
| POST /api/v2/posts     | Validate complete content, attach selected uploads and create a public entry atomically.                             |
| GET /api/v2/posts/{id} | Read current content and version, including legacy private entries for the authorized owner.                         |
| PUT /api/v2/posts/{id} | Replace complete content using the current version; save publicly, including when converting a legacy private entry. |

- No publish endpoint or intent field in v2. No preview URL; return post, editUrl and publicUrl. Keep HTTP 200 conventions and request correlation.
- Every mutation, including pre-entry uploads, requires an Idempotency-Key. Scope fingerprints to API version so a v1 receipt cannot be mistaken for v2. Preserve all existing v1 receipt/retry behavior.
- Prefer images: [{id, alt}], youtubeUrls and optional publishedDay. Default omitted image/video arrays to empty on create; require full arrays on PUT so omissions cannot silently remove attachments. Dates retain current preserve-on-omission behavior. Require version on PUT.
- Preserve v1 before/after compatibility only in v1. Reject unknown fields in v2 and expose actual input schemas in help.
- v1 help points clients to v2 and explicitly states that v1 creation still creates private drafts. v2 help explains that a save is immediately public, including examples for backfilling, updating dates and replacing images.
- Update publishing documentation, README and client .env examples to recommend the full /api/v2/posts URL and /api/v2/help discovery URL. Do not edit user secrets or remote clients automatically.

## Uploads and storage

Use existing post_images records with nullable post_id for unattached uploads. Assigned images keep their existing post IDs, keys and URLs. New uploads use an independent uploads/{uuid} object key; attaching does not move the object.

- Add authenticated owner-session and bearer-token upload routes sharing the same image validation/storage service. The browser uses session auth and existing origin checks; API uses bearer auth.
- Uploaded files remain private until a successful save attaches and activates them. Browser preview can use the selected local file; session-authenticated media reads may also serve staged images. Never expose unassigned uploads publicly.
- All authorized clients share the existing single-owner trust boundary. A save may claim unassigned images or reuse images already belonging to that entry; reject images belonging to any other entry.
- Within one transaction, lock cleanup markers and images in consistent order, validate ownership and uniqueness, claim uploads, write entry content/order/captions and save the API receipt. Concurrent attempts to claim one upload for different entries must yield only one success.
- Keep the durable cleanup marker before object upload. Unattached uploads expire after 24 hours; saving clears their markers. Removed images become private and eligible for delayed cleanup. Failed saves do not leave partially public content.
- Update readImage's join to allow authenticated access to unassigned images while retaining the public condition: active image attached to a public entry. Verify cleanup cannot race attachment.
- Uploading replacements for an existing entry never changes its public gallery until Save changes succeeds.

## Implementation sequence

1. Add the nullable-image-owner migration and shared pre-entry upload/atomic save services. Retain published internally for legacy draft visibility and v1 compatibility; do not drop or mass-update it.
2. Add v2 routing, schemas, help and version-aware idempotency. Keep v1 tests and behavior intact.
3. Refactor Editor to accept a new unsaved entry and existing records. Remove eager post creation and publication controls; wire the session upload/save actions to the shared services.
4. Update admin copy, legacy-private-entry handling, API docs and environment examples. Keep daily ordering and date behavior unchanged.
5. Run focused validation and review the final migration/API/editor changes. Commit the completed implementation after checks pass. Push only on explicit request.

## Acceptance checks

- Fresh editor visits and abandoned edits create no post records. Abandoned uploads stay private and remain cleanable.
- Saving a valid new entry with zero or several images/videos makes it visible immediately. Invalid content creates no public or partial entry.
- Updating a live entry, its date or gallery succeeds through editor and v2. A stale version is rejected without overwriting another client's edit.
- New entry plus attachment selection plus retry receipt is atomic. Identical retries create one entry; changed-body or cross-version key reuse conflicts. GET returns current state after receipt replay.
- Unassigned, removed and legacy-draft images return no public bytes. Cross-entry reuse and concurrent upload claims are rejected; cleanup/claim concurrency is safe.
- Migration preserves all existing data. Legacy drafts stay private until explicitly saved; original slugs, comments and polls remain attached when saved or backdated.
- v1 clients still create drafts and explicitly publish. v1/v2 help schemas and examples match executable requests. Invalid or disabled tokens cannot access help or mutations.
- Browser checks cover new-entry save with images, live edits, date changes, validation failures, legacy private conversion and mobile layout. Capture rendered desktop/mobile evidence.
- Run lint, typecheck, unit/integration tests, production build, relevant browser tests, formatting and diff checks. CI validates migrations from a fresh database; also exercise an upgrade fixture with a public post and a private draft.

## Rollout

Run the additive migration before deploying the app. No automatic data publication occurs. Announce the v2 endpoint change to publishing clients; existing v1 clients continue to work. A later removal of v1 and the legacy published state is a separate migration after client adoption is confirmed. Production deployment and client switching are not part of this planning session.
