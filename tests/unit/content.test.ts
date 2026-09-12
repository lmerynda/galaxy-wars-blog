import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { youtubeId, slugBase, validatePost } from "../../src/lib/post";
import {
  hashPassword,
  validHash,
  verifyPassword,
} from "../../src/server/password";
import { inspectImage } from "../../src/server/images";
import { checkOrigin, safeAdminPath } from "../../src/server/http";

describe("post boundaries", () => {
  it.each([
    "https://youtu.be/dQw4w9WgXcQ?t=1",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])("accepts video links: %s", (link) =>
    expect(youtubeId(link)).toBe("dQw4w9WgXcQ"),
  );
  it.each([
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "http://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com/playlist?list=123",
    "https://youtube.com/watch?v=short",
    "https://u:p@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ/extra",
  ])("rejects unsupported links: %s", (link) =>
    expect(() => youtubeId(link)).toThrow(),
  );
  it("allows omitted video, normalizes paragraphs, and enforces publication", () => {
    const draft = {
      id: randomUUID(),
      version: 0,
      title: "",
      paragraphOne: " first\n\nsecond ",
      paragraphTwo: "",
      youtubeUrl: "",
      beforeId: "",
      afterId: "",
      beforeAlt: "",
      afterAlt: "",
      intent: "draft",
    };
    expect(validatePost(draft).paragraphOne).toBe("first second");
    expect(validatePost(draft).videoId).toBeNull();
    expect(
      validatePost({ ...draft, publishedDay: "2024-02-29" }).publishedDay,
    ).toBe("2024-02-29");
    for (const publishedDay of [
      "2025-02-29",
      "2026-13-01",
      "0000-01-01",
      "09/01/2026",
    ])
      expect(() => validatePost({ ...draft, publishedDay })).toThrow();
    expect(
      validatePost({
        ...draft,
        youtubeUrls: Array(100).fill("https://youtu.be/dQw4w9WgXcQ"),
      }).videoIds,
    ).toHaveLength(100);
    expect(() =>
      validatePost({ ...draft, youtubeUrls: ["https://evil.test/video"] }),
    ).toThrow();
    expect(
      validatePost({
        ...draft,
        youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
        youtubeUrls: [],
      }).videoIds,
    ).toEqual([]);
    expect(() => validatePost({ ...draft, intent: "publish" })).toThrow(
      /To publish/,
    );
    expect(() => validatePost({ ...draft, title: "x".repeat(121) })).toThrow();
  });
  it("creates readable bounded slugs", () => {
    expect(slugBase("  A clearer Gálaxy! ")).toBe("a-clearer-galaxy");
    expect(slugBase("🌌")).toBe("update");
    expect(slugBase("x".repeat(200))).toHaveLength(80);
  });
});
describe("security", () => {
  it("salts passwords, fails closed, and verifies only the right password", async () => {
    const password = "test-only-password";
    const hash = await hashPassword(password);
    expect(validHash(hash)).toBe(true);
    expect(await hashPassword(password)).not.toBe(hash);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword(password, undefined)).toBe(false);
    expect(await verifyPassword(password, "broken")).toBe(false);
  });
  it("rejects missing and foreign origins and external login return URLs", () => {
    process.env.APP_URL = "https://blog.example.com";
    expect(() => checkOrigin("https://blog.example.com")).not.toThrow();
    expect(() => checkOrigin(null)).toThrow();
    expect(() => checkOrigin("https://blog.example.com.evil.test")).toThrow();
    expect(safeAdminPath("//evil.test")).toBe("/admin");
    expect(safeAdminPath("/admin/new")).toBe("/admin/new");
    expect(safeAdminPath("/admin/../evil")).toBe("/admin");
  });
});
describe("image decoding", () => {
  it("accepts still screenshots and rejects spoofed MIME, SVG, animation, truncation and large dimensions", async () => {
    const png = await sharp({
      create: { width: 60, height: 40, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    expect(await inspectImage(png, "image/png")).toMatchObject({
      width: 60,
      height: 40,
    });
    await expect(inspectImage(png, "image/jpeg")).rejects.toThrow();
    await expect(
      inspectImage(Buffer.from("<svg></svg>"), "image/png"),
    ).rejects.toThrow();
    await expect(
      inspectImage(png.subarray(0, 40), "image/png"),
    ).rejects.toThrow();
    await expect(
      inspectImage(Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"),
    ).rejects.toThrow(/10 MiB/);
    const large = await sharp({
      create: { width: 8001, height: 4000, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    await expect(inspectImage(large, "image/png")).rejects.toThrow();
    const frames = Buffer.alloc(2 * 2 * 3 * 2);
    frames.fill(255, 12);
    const animated = await sharp(frames, {
      raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    await expect(inspectImage(animated, "image/webp")).rejects.toThrow();
  });
});
