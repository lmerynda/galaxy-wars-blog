import { z } from "zod";
import { postInput } from "../lib/post";
import { MAX_IMAGE_BYTES } from "./images";
export const content = postInput
  .omit({ id: true, version: true })
  .extend({
    beforeId: postInput.shape.beforeId.default(""),
    afterId: postInput.shape.afterId.default(""),
    beforeAlt: postInput.shape.beforeAlt.default(""),
    afterAlt: postInput.shape.afterAlt.default(""),
  })
  .strict();
export const revision = z
  .object({ version: z.number().int().nonnegative() })
  .strict();

export function apiHelp() {
  return {
    apiVersion: "v1",
    helpVersion: 2,
    basePath: "/api/v1",
    workflow: "save-to-public",
    breakingChange:
      "POST and PUT now save publicly. The publish endpoint and post-specific image upload endpoints are removed. Old mutation keys cannot be replayed across this change; use fresh keys. Upload through POST /api/v1/images.",
    authentication: {
      header: "Authorization",
      scheme: "Bearer",
      tokenVariable: "BLOG_API_TOKEN",
      requiredForAllEndpoints: true,
      browserLogin: false,
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/help",
        description:
          "Discover capabilities, request schemas and examples. No database access or idempotency key required.",
      },
      {
        method: "POST",
        path: "/api/v1/posts",
        requestSchema: "create",
        description: "Create an entry immediately visible on the public log.",
      },
      {
        method: "GET",
        path: "/api/v1/posts/{id}",
        description: "Read current content, version and URLs.",
      },
      {
        method: "PUT",
        path: "/api/v1/posts/{id}",
        requestSchema: "update",
        description:
          "Replace the entry's complete content using its current version. Changes are immediately public.",
      },
      {
        method: "POST",
        path: "/api/v1/images",
        description:
          "Upload raw image bytes (not multipart or JSON). Returns {image}. Upload before creating an entry; save its ID in images to attach it.",
      },
    ],
    requestSchemas: {
      create: z.toJSONSchema(content, { io: "input" }),
      update: z.toJSONSchema(
        content.extend({ version: revision.shape.version }).strict(),
        { io: "input" },
      ),
    },
    dates: {
      field: "publishedDay",
      format: "YYYY-MM-DD",
      validation: "Real calendar date, year 0001–9999.",
      behavior:
        "Sets daily grouping; can be backdated. Omitted or empty preserves a saved date, otherwise defaults to the day of the first save in the blog timezone. Future dates are also public immediately. Original first-save timestamp is retained.",
      timeZone: process.env.BLOG_TIME_ZONE || "America/Chicago",
      dateEdits: "Use PUT or the owner editor to move an entry to another day.",
    },
    images: {
      countLimit: null,
      maxBytesEach: MAX_IMAGE_BYTES,
      maxPixelsEach: 32000000,
      contentTypes: ["image/png", "image/jpeg", "image/webp"],
      stillOnly: true,
      selection:
        "Send the complete ordered images array of {id, alt}. IDs must be unique and unassigned or already attached to this entry. Empty array allows text-only posts. Unselected uploads are eligible for cleanup after 24 hours.",
      legacy:
        "If images is omitted, beforeId/afterId and beforeAlt/afterAlt are used. Prefer the images array.",
    },
    videos: {
      field: "youtubeUrls",
      countLimit: null,
      urls: "HTTPS YouTube watch, shorts, or youtu.be links to individual videos. Playlists are not accepted.",
      behavior:
        "Ordered embedded players; [] removes all videos. Files are uploaded to YouTube separately.",
      legacy:
        "youtubeUrl is accepted if youtubeUrls is omitted. videoIds is returned; videoId remains the first video for compatibility.",
    },
    saving:
      "A nonempty title, both paragraphs, and alt descriptions for every selected image are required. Upload images first, then POST complete content. GET the current version before PUT. All saves are public immediately; no separate publish step exists.",
    requests: {
      replacement:
        "POST and PUT take complete content. Omitted image/video selections are empty; send the full arrays to retain them. Omitted or empty publishedDay preserves an existing date.",
      jsonContentType: "application/json",
      maxJsonBytes: 256 * 1024,
      unknownFields: "rejected",
      mutationHeader: "Idempotency-Key",
      keyFormat:
        "16–128 letters, digits, underscores or hyphens; UUID recommended",
      retry:
        "Retry with the same key, method, path, content type and exact body bytes. Receipts persist across restarts. A replay may return an older version; GET current state. Use a fresh key for each new operation. On version conflict, GET and review before retrying with a new key.",
    },
    responses: {
      successStatus: 200,
      postEnvelope: "{post, editUrl, publicUrl}",
      postFields: [
        "id",
        "slug",
        "title",
        "paragraphOne",
        "paragraphTwo",
        "videoId",
        "videoIds",
        "publishedAt",
        "publishedDay",
        "version",
        "images",
      ],
      imageFields: ["id", "role", "url", "width", "height", "alt"],
      urls: "Relative to this blog's origin. editUrl requires owner login; publicUrl is always available.",
      cacheControl: "no-store",
      requestIdHeader: "X-Request-ID",
      errors: {
        400: "Invalid input or key",
        401: "Invalid or disabled token",
        404: "Unknown endpoint or post",
        409: "Version or idempotency conflict",
        413: "Request too large",
        415: "Wrong JSON content type",
        503: "Temporary failure; JSON also includes requestId",
      },
    },
    examples: {
      createBackdatedEntry: {
        title: "Clearer targeting",
        paragraphOne: "Previously, nearby ships were difficult to select.",
        paragraphTwo:
          "Updated targeting makes the intended ship easier to select.",
        publishedDay: "2024-02-29",
        images: [],
        youtubeUrls: ["https://youtu.be/dQw4w9WgXcQ"],
      },
      updateEntry: {
        version: 1,
        title: "Clearer targeting",
        paragraphOne: "Previously, nearby ships were difficult to select.",
        paragraphTwo:
          "Updated targeting makes the intended ship easier to select.",
        publishedDay: "2024-03-01",
        images: [],
        youtubeUrls: [],
      },
    },
    ownerEditorOnly: ["Create/edit/close polls", "Moderate threaded comments"],
    unsupportedApiOperations: [
      "List or delete posts",
      "Upload video files",
      "Manage comments, votes or guest identities",
    ],
  };
}
