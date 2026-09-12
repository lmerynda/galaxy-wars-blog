# AI publishing API

The API prepares drafts for review and publishes only through a separate explicit request. It uses the same validation, private image storage and daily grouping as the owner editor. Published entries can only be edited or unpublished in the owner editor.

## Enable access

Generate a token locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Store it as `BLOG_API_TOKEN` in the Railway **application service**, redeploy, and put the same value in the publishing agent's secret store. Do not put it in prompts, URLs, Git, or client-side code. Empty/unset disables API access. Replace the token and redeploy to revoke existing access. The API token does not grant a browser login.

Migration `0002` creates persistent retry receipts. Railway's pre-deploy command must be `npm run db:migrate` before deploying this version.

All requests use `Authorization: Bearer <token>`. No cookies or Origin header are required. Responses are JSON with `Cache-Control: no-store`. URLs in responses are relative to the blog origin. Draft preview links open the existing editor and require the owner's normal password login; there is no public preview token.

## Workflow

1. `POST /api/v1/posts` creates a draft with the JSON fields below. Use empty image IDs initially.
2. `POST /api/v1/posts/{id}/images/before` and `/images/after` upload raw PNG, JPEG or WebP bytes, with the matching `Content-Type` (`image/png`, `image/jpeg`, `image/webp`). Each returns `{ "image": { "id": "…", ... } }`. Images remain staged and private until selected in a saved draft. Limits: 10 MiB, 32 megapixels, still images only. Save selections within 24 hours; abandoned uploads are eligible for existing storage cleanup.
3. `PUT /api/v1/posts/{id}` saves the complete JSON content below, including the latest `version` and uploaded image IDs. This is a full replacement, not a partial patch. It cannot publish or change a published entry.
4. Share `previewUrl` with the owner for review. The editor includes its usual preview.
5. After explicit publishing approval, `GET /api/v1/posts/{id}` retrieves the current post and version. Confirm the content is still the approved version; if it changed, seek a fresh review.
6. `POST /api/v1/posts/{id}/publish` with `{ "version": 2 }` publishes the saved content and returns `publicUrl`. Both paragraphs and descriptions for all selected images must be present. The first publication date determines the daily page.

Create JSON (all fields required; draft values can be empty):

```json
{
  "title": "Clearer targeting",
  "paragraphOne": "Previously, selecting a nearby ship was difficult.",
  "paragraphTwo": "The updated targeting makes the intended ship easier to select.",
  "youtubeUrls": ["https://youtu.be/VIDEO_ID_HERE"],
  "beforeId": "",
  "afterId": "",
  "beforeAlt": "Targeting before the change",
  "afterAlt": "Targeting after the change"
}
```

For PUT, add `"version": <current post.version>`. Titles allow 120 characters, each paragraph 1,500, alt text 200, and each HTTPS YouTube URL 2,048. `youtubeUrls` is an ordered array with no video-count limit; send `[]` to remove all videos. The overall API request-size limit still applies. Unknown fields are rejected. Send `youtubeUrls`, not the returned `videoIds`. Legacy `youtubeUrl` is still accepted when `youtubeUrls` is omitted; the array takes precedence. Responses retain `videoId` as the first video for older clients. Videos render as embedded players.

Create, save, read and publish return:

```json
{
  "post": { "id": "…", "version": 1, "published": false, "images": [] },
  "previewUrl": "/admin/posts/…/edit",
  "publicUrl": null
}
```

The actual `post` also contains content and publication metadata. All successful requests return HTTP 200.

## Safe retries

Every mutation requires an `Idempotency-Key`: a fresh UUID is recommended (16–128 letters, digits, underscores or hyphens). Keep the same key, method, path, content type and exact body bytes when retrying that request. The successful response is stored durably with the write and replayed on retries, including after restarts. Keys are global to this blog and survive token rotation. Reusing a key for different content returns 409. Receipts are retained indefinitely; they contain content snapshots but no API tokens.

A replay returns the original response, which can have an older version. GET the post for its current state. Never reuse a key for a new edit or upload. A retry of an abandoned, expired upload can return its original image ID; use a fresh key and upload again if it has been cleaned up.

Failed writes do not record a success receipt. After a timeout or 503, retry unchanged with the same key. After a 409 version conflict, GET and review current content before issuing a new request with a new key. This prevents duplicate posts and protects edits made through the browser.

Errors have `{ "error": "message" }`: 400 invalid content/key, 401 invalid/disabled token, 404 missing endpoint/post, 409 conflict, 413 too large, 415 wrong JSON content type, 503 temporary failure. Every response includes `X-Request-ID`; unexpected 503 responses also include `requestId` in their JSON. Search Railway's **Deploy Logs** for that ID to find the structured `api.request.failed` event. It includes the operation (such as `storage.putObject`), safe error codes, provider status/request ID, and missing storage variable names. Raw error messages, SQL, headers and draft content are omitted. Railway's HTTP access log alone only shows the request status and duration. No API token is accepted in a query string, cookie or preview URL.

Example upload (POSIX shell; token loaded from your secret store):

```sh
curl --fail-with-body "$BLOG_URL/api/v1/posts/$POST_ID/images/before" \
  -H "Authorization: Bearer $BLOG_API_TOKEN" \
  -H "Idempotency-Key: $UPLOAD_REQUEST_ID" \
  -H "Content-Type: image/png" \
  --data-binary @before.png
```

## Flexible image galleries

For new clients, upload each image to `POST /api/v1/posts/{id}/images/gallery`, then send `images: [{"id":"uploaded UUID","alt":"Proposal A"}, ...]` in the create/PUT body. The array is the full gallery in display order; omit an image to remove it on save. There is no image-count limit, and `images: []` supports text-only updates. Each image retains the 10 MiB/32-megapixel limit, and JSON requests are limited to 256 KiB. Selected images must belong to this entry and have unique IDs.

The old `/images/before` and `/images/after` endpoints and `beforeId`/`afterId` fields remain supported. When `images` is present it takes precedence, and the four legacy image fields may be omitted. PUT without `images` uses the legacy pair, so gallery clients should always send the full array. Publishing uses all saved images. Poll creation and moderation are available in the owner editor; the publishing API does not manage guest identities or votes.

Optional `publishedDay` (`YYYY-MM-DD`) sets the entry’s calendar date on create or draft PUT. It survives publication and controls daily grouping. Omit it or send an empty string to preserve the saved date; a new entry without a date uses the blog timezone on publication. Use the owner editor to change dates of live entries. This does not schedule publication.
