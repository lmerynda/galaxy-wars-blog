# Entry API

Every successful save is immediately public. POST creates an entry and PUT corrects an existing entry. There is no draft, preview, publish or unpublish workflow.

## Access and discovery

Set BLOG_API_TOKEN on the application service and in the client's secret store. Use a random token of at least 32 characters, for example the hex output of 32 random bytes. Empty/unset disables access. Token rotation requires restarting the application; the API token does not grant browser login. Never place it in a URL or commit it.

All endpoints require Authorization: Bearer <token>. Cookies and Origin are not required for API requests. GET /api/v1/help returns executable request schemas, examples, capabilities and limits. Fetch help before preparing requests. No idempotency key is required for GET.

Client configuration (values are examples; keep the real token private):

```dotenv
BLOG_URL=https://your-blog.up.railway.app
BLOG_POST_URL=https://your-blog.up.railway.app/api/v1/posts
BLOG_HELP_URL=https://your-blog.up.railway.app/api/v1/help
BLOG_API_TOKEN=your-secret-token
```

```sh
curl --fail-with-body "$BLOG_HELP_URL" -H "Authorization: Bearer $BLOG_API_TOKEN"
```

## Save an entry

1. Optionally upload each image to POST /api/v1/images, using raw PNG/JPEG/WebP bytes with its matching Content-Type. This works before an entry exists. Each response is {image: {id, role, url, width, height, alt}}. The image remains private until selected in a successful save.
2. POST /api/v1/posts with complete content and the ordered uploaded IDs. It returns the public entry immediately.
3. To correct an entry, GET /api/v1/posts/{id}, then PUT the complete content plus its current version to the same URL. Use the latest content to avoid overwriting another client's changes.

```json
{
  "title": "Clearer targeting",
  "paragraphOne": "Previously, selecting nearby ships was difficult.",
  "paragraphTwo": "Updated targeting makes the intended ship easier to select.",
  "publishedDay": "2024-02-29",
  "images": [],
  "youtubeUrls": []
}
```

For images send images: [{"id":"uploaded UUID","alt":"Description"}, ...]. For videos send youtubeUrls: ["https://youtu.be/VIDEO_ID_HERE", ...]. Each video is embedded. Video files are uploaded to YouTube separately; playlist URLs are not supported.

PUT adds version (a nonnegative integer from GET). It is a full replacement, not a partial patch. Send the full image/video selections to retain them; omitted selections are empty. Empty arrays explicitly remove all selections. Unknown fields, including intent, are rejected. Existing beforeId/afterId and beforeAlt/afterAlt fields can still select older role-tagged images when images is omitted; prefer images. youtubeUrl is accepted only as a fallback when youtubeUrls is omitted.

Optional publishedDay is a real YYYY-MM-DD date in years 0001–9999. On creation it defaults to the first-save day in BLOG_TIME_ZONE. On edit, omission or an empty string preserves the saved day. It supports backfilling and moving records between daily pages. Future dates are public immediately. Changing content or dates preserves the original publishedAt timestamp and slug; publishedAt now describes first public save, not a separate publication action.

Success returns HTTP 200 and {post, editUrl, publicUrl}; URLs are relative to the blog origin. The owner edit URL requires normal browser login. Post includes id, slug, title, paragraphOne, paragraphTwo, publishedDay, publishedAt, version, images, videoIds and the first-video alias videoId. There is no published flag or previewUrl.

## Validation and uploads

Title and both paragraphs must be nonempty. Limits: title 120 characters, each paragraph 1,500, each image description 200, each YouTube URL 2,048. Every selected image needs a description. Image/video counts have no explicit limit; JSON requests are limited to 256 KiB. Zero images and zero videos are valid.

Images must be still PNG, JPEG or WebP, at most 10 MiB and 32 megapixels. Selected IDs must be unique and either unattached or already owned by the entry. An image cannot be shared across entries. Uploads are eligible for cleanup after 24 hours until attached; save promptly. Removing an image makes it private immediately and queues delayed cleanup. Replacements remain private until saved, and failed saves preserve the existing public entry.

```sh
curl --fail-with-body "$BLOG_URL/api/v1/images" \
  -H "Authorization: Bearer $BLOG_API_TOKEN" \
  -H "Idempotency-Key: $UPLOAD_REQUEST_ID" \
  -H "Content-Type: image/png" \
  --data-binary @screenshot.png
```

## Retries and errors

Every mutation needs a unique Idempotency-Key: 16–128 letters, digits, underscores or hyphens; UUID recommended. Retry the same operation using the same key, method, path, Content-Type and exact body bytes. A receipt commits atomically with the save. Same-key retries replay the original response; a changed request returns 409. GET current state after replay because its version may be older. Keys persist across restarts and token rotation. After a version conflict, GET current content before sending a new operation with a new key.

Responses use Cache-Control: no-store and X-Request-ID. Errors return {error}: 400 invalid fields/key, 401 invalid/disabled token, 404 missing post/endpoint, 409 version/key conflict, 413 oversized body, 415 wrong JSON content type, 503 temporary failure. Unexpected failures include requestId in JSON and emit a structured api.request.failed event in deployment logs without secrets or entry content. Retry a timeout/503 unchanged with the same key.

## Upgrade and removed endpoints

This intentionally changes the existing v1 API. POST and PUT are immediately public; /posts/{id}/publish and /posts/{id}/images/{role} are removed. Upload through /api/v1/images. Mutation fingerprints changed so pre-upgrade receipt keys conflict instead of replaying obsolete draft responses. Read migrated entries again because the migration increments their versions, and use fresh operation keys. There is no legacy publication layer or v2 API.

Migration 0005 exposes every existing record with its saved content before removing publication state. It does not invent missing descriptions. All subsequent saves must meet current validation. Poll creation/editing and comment moderation stay in the owner editor, available after an entry's first save. The API does not list/delete entries or manage comments, votes or guest identities.
