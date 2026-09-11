import { afterAll, beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { prepareTestDatabase } from "../support/database";
import { db, closeDb } from "../../src/server/db";
import { hashPassword, digest } from "../../src/server/password";
import { login, logout, sessionValid } from "../../src/server/auth";
import {
  createPost,
  savePost,
  publicPost,
  publicDays,
  publicDay,
  ownerPost,
} from "../../src/server/posts";
import {
  uploadImage,
  readImage,
  cleanupStorage,
} from "../../src/server/images";
import * as storage from "../../src/server/storage";
import type { PostInput } from "../../src/lib/post";
import { publicationDay } from "../../src/lib/day";
import { readFile } from "node:fs/promises";

let token: string, png: Buffer;
const password = "integration-test-only-password";
beforeAll(async () => {
  await prepareTestDatabase("galaxy_wars_blog_test");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(password);
  token = await login(password, "initial-test");
  png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#345678" },
  })
    .png()
    .toBuffer();
  await storage.checkStorage();
});
afterAll(async () => {
  vi.restoreAllMocks();
  const keys =
    await db()`select object_key from post_images union select object_key from storage_cleanup`;
  for (const key of keys) await storage.deleteObject(key.object_key);
  await closeDb();
});
async function completeInput(title = "A clearer galaxy") {
  const id = await createPost(token);
  const before = await uploadImage(token, id, "before", png, "image/png");
  const after = await uploadImage(token, id, "after", png, "image/png");
  const input: PostInput = {
    id,
    version: 0,
    title,
    paragraphOne: "The original view needed clarity.",
    paragraphTwo: "The new view makes every choice clear.",
    youtubeUrl: "",
    beforeId: before.id,
    afterId: after.id,
    beforeAlt: "Original view",
    afterAlt: "Improved view",
    intent: "publish",
  };
  return { input, before, after };
}
it("protects all owner operations and private images", async () => {
  await expect(createPost()).rejects.toThrow(/sign in/);
  await expect(savePost(undefined, {})).rejects.toThrow(/sign in/);
  await expect(
    uploadImage(undefined, randomUUID(), "before", png, "image/png"),
  ).rejects.toThrow(/sign in/);
  await expect(ownerPost(randomUUID())).rejects.toThrow(/sign in/);
  const { input, before } = await completeInput("Private test");
  await savePost(token, { ...input, intent: "draft" });
  expect((await publicDays()).days).toHaveLength(0);
  expect(await readImage(before.id)).toBeNull();
  const ownerImage = await readImage(before.id, token);
  expect(ownerImage?.mime).toBe("image/png");
  await ownerImage?.body?.cancel();
});
it("publishes, stages replacements privately, preserves slugs/dates, rejects stale writes and unpublishes", async () => {
  const { input, before, after } = await completeInput();
  let post = await savePost(token, input);
  expect(post.slug).toBe("a-clearer-galaxy");
  expect(await publicPost(post.slug!)).toMatchObject({
    paragraphOne: input.paragraphOne,
  });
  const readable = await readImage(after.id);
  expect(readable).not.toBeNull();
  await readable?.body?.cancel();
  const replacement = await uploadImage(
    token,
    input.id,
    "after",
    png,
    "image/png",
  );
  expect(await readImage(replacement.id)).toBeNull();
  expect(
    (await publicPost(post.slug!))?.images.find((i) => i.role === "after")?.id,
  ).toBe(after.id);
  await expect(
    savePost(token, { ...input, version: post.version, afterId: before.id }),
  ).rejects.toThrow(/does not belong/);
  const originalDate = post.publishedAt;
  const originalDay = post.publishedDay;
  post = await savePost(token, {
    ...input,
    version: post.version,
    title: "Renamed title",
    afterId: replacement.id,
  });
  expect(post.slug).toBe("a-clearer-galaxy");
  expect(post.publishedAt).toBe(originalDate);
  expect(post.publishedDay).toBe(originalDay);
  expect(await readImage(after.id)).toBeNull();
  await expect(savePost(token, input)).rejects.toThrow(/another tab/);
  post = await savePost(token, {
    ...input,
    version: post.version,
    afterId: replacement.id,
    intent: "unpublish",
  });
  expect(await publicPost(post.slug!)).toBeNull();
  expect(await readImage(before.id)).toBeNull();
  post = await savePost(token, {
    ...input,
    version: post.version,
    afterId: replacement.id,
  });
  expect(post.publishedAt).toBe(originalDate);
});
it("handles title collisions and rejects foreign post images", async () => {
  const a = await completeInput(),
    b = await completeInput();
  const results = await Promise.all([
    savePost(token, a.input),
    savePost(token, b.input),
  ]);
  expect(results[0].slug).not.toBe(results[1].slug);
  await expect(
    savePost(token, {
      ...a.input,
      version: results[0].version,
      afterId: b.after.id,
    }),
  ).rejects.toThrow(/does not belong/);
  const duplicates =
    await db()`select post_id, role, count(*) from post_images where active group by post_id, role having count(*) > 1`;
  expect(duplicates).toHaveLength(0);
});
it("preserves old content on storage failure and retries cleanup without deleting active objects", async () => {
  const { input } = await completeInput("Failure testing");
  await savePost(token, input);
  const put = vi
    .spyOn(storage, "putObject")
    .mockRejectedValueOnce(new Error("Injected upload failure"));
  await expect(
    uploadImage(token, input.id, "after", png, "image/png"),
  ).rejects.toThrow(/Injected/);
  put.mockRestore();
  expect(
    (await ownerPost(input.id, token))?.images.find((i) => i.role === "after")
      ?.id,
  ).toBe(input.afterId);
  const staged = await uploadImage(token, input.id, "after", png, "image/png");
  await db()`update storage_cleanup set not_before = now() - interval '1 hour'`;
  const remove = vi
    .spyOn(storage, "deleteObject")
    .mockRejectedValueOnce(new Error("Injected delete failure"));
  expect((await cleanupStorage()).failed).toBe(1);
  remove.mockRestore();
  await db()`update storage_cleanup set not_before = now() - interval '1 hour'`;
  expect((await cleanupStorage()).failed).toBe(0);
  expect(await readImage(staged.id, token)).toBeNull();
  expect((await ownerPost(input.id, token))?.images).toHaveLength(2);
  expect(await cleanupStorage()).toEqual({ deleted: 0, failed: 0 });
});
it("rolls back database failures without replacing an active image", async () => {
  const { input } = await completeInput("Transaction testing");
  const saved = await savePost(token, input);
  const replacement = await uploadImage(
    token,
    input.id,
    "after",
    png,
    "image/png",
  );
  await db()`alter table posts add constraint test_reject_title check (title <> 'reject-this-save')`;
  try {
    await expect(
      savePost(token, {
        ...input,
        version: saved.version,
        afterId: replacement.id,
        title: "reject-this-save",
      }),
    ).rejects.toThrow();
    const current = await ownerPost(input.id, token);
    expect(current?.version).toBe(saved.version);
    expect(current?.images.find((i) => i.role === "after")?.id).toBe(
      input.afterId,
    );
    expect(await readImage(replacement.id)).toBeNull();
  } finally {
    await db()`alter table posts drop constraint test_reject_title`;
  }
});
it("retains posts, images, sessions and rate limits across database connection restarts", async () => {
  const { input } = await completeInput("Restart test");
  const saved = await savePost(token, input);
  for (let i = 0; i < 5; i++)
    await expect(login("wrong", "limited-client")).rejects.toThrow(/Unable/);
  await closeDb();
  await expect(login(password, "limited-client")).rejects.toThrow(/Too many/);
  expect(await sessionValid(token)).toBe(true);
  expect((await publicPost(saved.slug!))?.title).toBe("Restart test");
  const image = await readImage(input.afterId);
  expect(image).not.toBeNull();
  await image?.body?.cancel();
});
it("rejects expired, tampered, logged-out and rotated-password sessions", async () => {
  const session = await login(password, "session-tests");
  expect(await sessionValid("0".repeat(64))).toBe(false);
  await db()`update admin_sessions set expires_at = now() - interval '1 second' where token_hash = ${digest(session)}`;
  expect(await sessionValid(session)).toBe(false);
  const other = await login(password, "session-tests");
  await logout(other);
  expect(await sessionValid(other)).toBe(false);
  const prior = process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_PASSWORD_HASH = await hashPassword("changed-test-password");
  expect(await sessionValid(token)).toBe(false);
  process.env.ADMIN_PASSWORD_HASH = prior;
});

it("groups by first publication day, keeps chronological entry order and hides only the unpublished entry", async () => {
  const first = await completeInput("Daily first"),
    second = await completeInput("Daily second"),
    next = await completeInput("Next day");
  vi.useFakeTimers({ toFake: ["Date"] });
  process.env.BLOG_TIME_ZONE = "America/Chicago";
  try {
    vi.setSystemTime(new Date("2025-09-10T12:00:00Z"));
    let a = await savePost(token, first.input);
    vi.setSystemTime(new Date("2025-09-11T04:59:59Z"));
    const b = await savePost(token, second.input);
    vi.setSystemTime(new Date("2025-09-11T05:00:00Z"));
    const c = await savePost(token, next.input);
    expect(a.publishedDay).toBe("2025-09-10");
    expect(b.publishedDay).toBe(a.publishedDay);
    expect(c.publishedDay).toBe("2025-09-11");
    expect((await publicDay(a.publishedDay!))?.posts.map((p) => p.id)).toEqual([
      a.id,
      b.id,
    ]);
    expect(
      (await publicDays()).days.find((day) => day.day === a.publishedDay),
    ).toMatchObject({
      count: 2,
      titles: [a.title, b.title],
      image: { id: b.images.find((image) => image.role === "after")!.id },
    });
    a = await savePost(token, {
      ...first.input,
      version: a.version,
      intent: "unpublish",
    });
    expect((await publicDay(a.publishedDay!))?.posts.map((p) => p.id)).toEqual([
      b.id,
    ]);
    expect(await readImage(first.before.id)).toBeNull();
    process.env.BLOG_TIME_ZONE = "Asia/Tokyo";
    a = await savePost(token, { ...first.input, version: a.version });
    expect(a.publishedDay).toBe("2025-09-10");
    expect((await publicDay(a.publishedDay!))?.posts.map((p) => p.id)).toEqual([
      a.id,
      b.id,
    ]);
    await savePost(token, {
      ...next.input,
      version: c.version,
      intent: "unpublish",
    });
    expect(await publicDay("2025-09-11")).toBeNull();
    expect(
      (await publicDays()).days.some((day) => day.day === "2025-09-11"),
    ).toBe(false);
    expect(await publicDay("2025-02-30")).toBeNull();
  } finally {
    vi.useRealTimers();
    delete process.env.BLOG_TIME_ZONE;
  }
});

it("paginates whole days rather than splitting same-day entries", async () => {
  const added: string[] = [];
  for (let index = 1; index <= 14; index++) {
    const entry = await completeInput(`Pagination ${index}`);
    const post = await savePost(token, entry.input);
    const day = `2030-01-${String(index).padStart(2, "0")}`;
    await db()`update posts set published_day = ${day}, published_at = ${`${day}T12:00:00Z`} where id = ${post.id}`;
    added.push(post.id);
  }
  const first = await publicDays(1),
    second = await publicDays(2);
  expect(first.days).toHaveLength(12);
  expect(first.hasMore).toBe(true);
  expect(first.days[0].day).toBe("2030-01-14");
  expect(first.days.at(-1)?.day).toBe("2030-01-03");
  expect(second.days[0].day).toBe("2030-01-02");
  expect(
    second.days.some((day) =>
      first.days.some((previous) => previous.day === day.day),
    ),
  ).toBe(false);
  const sql = db();
  await sql`update posts set published = false where id in ${sql(added)}`;
});

it("backfills pre-existing published and unpublished entries without shifting their Chicago day", async () => {
  const migration = await readFile(
    "drizzle/0001_tearful_ser_duncan.sql",
    "utf8",
  );
  await db().begin(async (tx) => {
    // A temporary pre-migration posts table shadows only this transaction's real table.
    await tx`create temporary table posts (id uuid, slug text, published boolean, published_at timestamptz,
      constraint publication_metadata check (not published or (slug is not null and published_at is not null))) on commit drop`;
    await tx`insert into posts values (${randomUUID()}, 'old-entry', true, '2026-09-11T04:59:59Z'),
      (${randomUUID()}, 'unpublished-entry', false, '2026-09-11T05:00:00Z'),
      (${randomUUID()}, null, false, null)`;
    for (const statement of migration.split("--> statement-breakpoint"))
      if (statement.trim()) await tx.unsafe(statement);
    const rows =
      await tx`select slug, published_day::text as day from posts order by published_at nulls last`;
    expect(rows).toEqual([
      { slug: "old-entry", day: "2026-09-10" },
      { slug: "unpublished-entry", day: "2026-09-11" },
      { slug: null, day: null },
    ]);
    expect(publicationDay(new Date("2026-09-11T04:59:59Z"))).toBe(rows[0].day);
  });
});
