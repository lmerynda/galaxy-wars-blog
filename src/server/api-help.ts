import { z } from "zod";
import { postInput } from "../lib/post";
import { MAX_IMAGE_BYTES } from "./images";
export const content = postInput
  .omit({ id: true, version: true, intent: true })
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
    helpVersion: 1,
    basePath: "/api/v1",
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
        description: "Create a private draft.",
      },
      {
        method: "GET",
        path: "/api/v1/posts/{id}",
        description:
          "Read current content, version and URLs, including private drafts.",
      },
      {
        method: "PUT",
        path: "/api/v1/posts/{id}",
        requestSchema: "update",
        description:
          "Replace a draft's complete content using its current version. Live edits are owner-editor only.",
      },
      {
        method: "POST",
        path: "/api/v1/posts/{id}/images/{role}",
        description:
          "Upload raw image bytes (not multipart or JSON). role: gallery, before or after. Returns {image}. Save its ID in images before publishing.",
      },
      {
        method: "POST",
        path: "/api/v1/posts/{id}/publish",
        requestSchema: "publish",
        description:
          "Publish saved draft content using its current version. Does not accept content fields.",
      },
    ],
    requestSchemas: {
      create: z.toJSONSchema(content, { io: "input" }),
      update: z.toJSONSchema(
        content.extend({ version: revision.shape.version }).strict(),
        { io: "input" },
      ),
      publish: z.toJSONSchema(revision),
    },
    dates: {
      field: "publishedDay",
      format: "YYYY-MM-DD",
      validation: "Real calendar date, year 0001–9999.",
      behavior:
        "Sets daily grouping; can be backdated. Omitted or empty preserves a saved date, otherwise defaults to the blog's publication day. Does not schedule publication. Original publication timestamp is retained.",
      timeZone: process.env.BLOG_TIME_ZONE || "America/Chicago",
      liveDateEdits:
        "Use the owner editor to move a published entry to another day.",
    },
    images: {
      countLimit: null,
      maxBytesEach: MAX_IMAGE_BYTES,
      maxPixelsEach: 32000000,
      contentTypes: ["image/png", "image/jpeg", "image/webp"],
      stillOnly: true,
      selection:
        "Send the complete ordered images array of {id, alt}. IDs must be unique and belong to the post. Empty array allows text-only posts. Unselected uploads are eligible for cleanup after 24 hours.",
      legacy:
        "If images is omitted, beforeId/afterId and beforeAlt/afterAlt are used. Legacy publication requires both images.",
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
    publication:
      "A nonempty title, both paragraphs, and alt descriptions for every selected image are required. Create a draft, upload and select images, review, GET the current version, then explicitly publish.",
    requests: {
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
      postEnvelope: "{post, previewUrl, publicUrl}",
      postFields: [
        "id",
        "slug",
        "title",
        "paragraphOne",
        "paragraphTwo",
        "videoId",
        "videoIds",
        "published",
        "publishedAt",
        "publishedDay",
        "version",
        "images",
      ],
      imageFields: ["id", "role", "url", "width", "height", "alt"],
      urls: "Relative to this blog's origin. previewUrl requires owner login; publicUrl is null for drafts.",
      cacheControl: "no-store",
      requestIdHeader: "X-Request-ID",
      errors: {
        400: "Invalid input or key",
        401: "Invalid or disabled token",
        404: "Unknown endpoint or post",
        409: "Version, publication state or idempotency conflict",
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
      updateDraft: {
        version: 1,
        title: "Clearer targeting",
        paragraphOne: "Previously, nearby ships were difficult to select.",
        paragraphTwo:
          "Updated targeting makes the intended ship easier to select.",
        publishedDay: "2024-03-01",
        images: [],
        youtubeUrls: [],
      },
      publish: { version: 2 },
    },
    ownerEditorOnly: [
      "Edit or unpublish live entries",
      "Create/edit/close polls",
      "Moderate threaded comments",
    ],
    unsupportedApiOperations: [
      "List or delete posts",
      "Upload video files",
      "Manage comments, votes or guest identities",
    ],
  };
}
