import { afterAll, beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
let token: string, png: Buffer;
const password = "integration-test-only-password";
const content = {
  title: "A clearer galaxy",
  paragraphOne: "The original view.",
  paragraphTwo: "The improved view.",
  images: [],
  youtubeUrls: [],
};
beforeAll(async () => {
  await prepareTestDatabase("galaxy_wars_blog_test");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(password);
  token = await login(password, "initial-test");
  png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#345678" },
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
it("requires authentication and valid content before creating any entry", async () => {
  await expect(createPost(undefined, content)).rejects.toThrow(/sign in/);
  await expect(savePost(undefined, {})).rejects.toThrow(/sign in/);
  await expect(uploadImage(undefined, png, "image/png")).rejects.toThrow(
    /sign in/,
  );
  await expect(createPost(token, { ...content, title: "" })).rejects.toThrow();
  expect((await publicDays()).days).toHaveLength(0);
  const image = await uploadImage(token, png, "image/png");
  expect(await readImage(image.id)).toBeNull();
  const privateImage = await readImage(image.id, token);
  expect(privateImage).not.toBeNull();
  await privateImage?.body?.cancel();
  expect(await ownerPost(randomUUID(), token)).toBeNull();
});
it("saves publicly in one transaction and keeps replacements private until saved", async () => {
  const image = await uploadImage(token, png, "image/png");
  const selection = { id: image.id, alt: "Original" };
  let post = await createPost(token, {
    ...content,
    images: [selection],
    publishedDay: "2024-02-29",
  });
  expect(await publicPost(post.slug!)).toMatchObject({ id: post.id });
  const response = await readImage(image.id);
  expect(response).not.toBeNull();
  await response?.body?.cancel();
  const next = await uploadImage(token, png, "image/png");
  expect(await readImage(next.id)).toBeNull();
  const changed = await savePost(token, {
    ...content,
    id: post.id,
    version: post.version,
    images: [{ id: next.id, alt: "Improved" }],
    publishedDay: "2023-12-31",
  });
  expect(changed.slug).toBe(post.slug);
  expect(changed.publishedAt).toBe(post.publishedAt);
  expect(await publicDay("2024-02-29")).toBeNull();
  expect((await publicDay("2023-12-31"))?.posts[0].id).toBe(post.id);
  expect(await readImage(image.id)).toBeNull();
  await expect(
    savePost(token, { ...content, id: post.id, version: post.version }),
  ).rejects.toThrow(/changed/);
  post = await savePost(token, {
    ...content,
    id: post.id,
    version: changed.version,
    publishedDay: "",
  });
  expect(post.publishedDay).toBe("2023-12-31");
  expect(post.images).toHaveLength(0);
});
it("claims uploads once, rejects cross-entry reuse, and rolls back failed claims", async () => {
  const image = await uploadImage(token, png, "image/png");
  const selected = { ...content, images: [{ id: image.id, alt: "Proposal" }] };
  const results = await Promise.allSettled([
    createPost(token, selected),
    createPost(token, selected),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  await expect(createPost(token, selected)).rejects.toThrow(/does not belong/);
  const next = await uploadImage(token, png, "image/png");
  await db()`alter table posts add constraint reject_save check (title <> 'reject-this-save')`;
  try {
    await expect(
      createPost(token, {
        ...content,
        title: "reject-this-save",
        images: [{ id: next.id, alt: "Next" }],
      }),
    ).rejects.toThrow();
    expect(await readImage(next.id)).toBeNull();
    expect(
      (await db()`select post_id from post_images where id = ${next.id}`)[0]
        .post_id,
    ).toBeNull();
  } finally {
    await db()`alter table posts drop constraint reject_save`;
  }
});
it("serializes concurrent saves for a new browser entry ID without duplicates", async () => {
  const input = { ...content, id: randomUUID(), version: 0 };
  const results = await Promise.allSettled([
    savePost(token, input, undefined, true),
    savePost(token, input, undefined, true),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db()`select id from posts where id = ${input.id}`).toHaveLength(
    1,
  );
});
it("cleanup retries failures and cannot delete attached images", async () => {
  const image = await uploadImage(token, png, "image/png");
  const post = await createPost(token, {
    ...content,
    images: [{ id: image.id, alt: "Active" }],
  });
  const staged = await uploadImage(token, png, "image/png");
  await db()`update storage_cleanup set not_before = now() - interval '1 hour'`;
  const remove = vi
    .spyOn(storage, "deleteObject")
    .mockRejectedValueOnce(new Error("Injected failure"));
  expect((await cleanupStorage()).failed).toBe(1);
  remove.mockRestore();
  await db()`update storage_cleanup set not_before = now() - interval '1 hour'`;
  expect((await cleanupStorage()).failed).toBe(0);
  expect(await readImage(staged.id, token)).toBeNull();
  expect((await ownerPost(post.id, token))?.images).toHaveLength(1);
  const put = vi
    .spyOn(storage, "putObject")
    .mockRejectedValueOnce(new Error("Injected failure"));
  await expect(uploadImage(token, png, "image/png")).rejects.toMatchObject({
    operation: "storage.putObject",
  });
  put.mockRestore();
});
it("cleanup and attachment races never leave a public missing object", async () => {
  const image = await uploadImage(token, png, "image/png");
  await db()`update storage_cleanup set not_before = now() - interval '1 hour' where object_key = (select object_key from post_images where id = ${image.id})`;
  const [save] = await Promise.allSettled([
    createPost(token, {
      ...content,
      images: [{ id: image.id, alt: "Concurrent" }],
    }),
    cleanupStorage(),
  ]);
  if (save.status === "fulfilled") {
    const response = await readImage(image.id);
    expect(response).not.toBeNull();
    await response?.body?.cancel();
  } else expect(await readImage(image.id)).toBeNull();
});
it("keeps daily entries newest first and preserves ordering when edited", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const a = await createPost(token, {
      ...content,
      title: "First",
      publishedDay: "2020-01-01",
    });
    vi.setSystemTime(new Date("2026-01-01T13:00:00Z"));
    const b = await createPost(token, {
      ...content,
      title: "Second",
      publishedDay: "2020-01-01",
    });
    await savePost(token, {
      ...content,
      id: a.id,
      version: a.version,
      title: "First edited",
    });
    expect((await publicDay("2020-01-01"))?.posts.map((p) => p.id)).toEqual([
      b.id,
      a.id,
    ]);
    expect(
      (await publicDays()).days.find((d) => d.day === "2020-01-01")?.titles,
    ).toEqual(["Second", "First edited"]);
  } finally {
    vi.useRealTimers();
  }
});
it("retains content and authentication limits across restarts", async () => {
  const post = await createPost(token, content);
  for (let i = 0; i < 5; i++)
    await expect(login("wrong", "limited-client")).rejects.toThrow(/Unable/);
  await closeDb();
  await expect(login(password, "limited-client")).rejects.toThrow(/Too many/);
  expect(await sessionValid(token)).toBe(true);
  expect((await publicPost(post.slug!))?.id).toBe(post.id);
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

it("migrates every old entry, including empty drafts, without changing content or existing links", async () => {
  const migration = await readFile("drizzle/0005_wealthy_luckman.sql", "utf8");
  const schema = "migration_" + randomUUID().replaceAll("-", "");
  const rollback = new Error("rollback fixture");
  await expect(
    db().begin(async (tx) => {
      await tx.unsafe(`create schema ${schema}`);
      await tx.unsafe(`set local search_path to ${schema}, public`);
      await tx`create table posts (id uuid primary key, slug text unique, title text, paragraph_one text, published boolean default false, published_at timestamptz, published_day date, created_at timestamptz default now(), version integer default 0, constraint publication_metadata check (not published or slug is not null))`;
      await tx`create index published_days on posts(published_day,published_at) where published`;
      await tx`create table post_images (id uuid primary key,post_id uuid not null references posts(id),active boolean)`;
      const a = randomUUID(),
        b = randomUUID(),
        c = randomUUID();
      await tx`insert into posts(id,slug,title,paragraph_one,published,published_at,published_day) values (${a},'existing-link','Live','Original',true,'2020-01-01','2020-01-01')`;
      await tx`insert into posts(id,title,paragraph_one,created_at) values (${b},'','', '2024-03-01T01:00:00Z'), (${c},'Backfill','Saved text','2024-03-01T01:00:00Z')`;
      await tx`update posts set published_day='2022-05-03' where id=${c}`;
      const image = randomUUID();
      await tx`insert into post_images values (${image},${b},true)`;
      await tx`select set_config('blog.time_zone','America/Chicago',true)`;
      for (const statement of migration.split("--> statement-breakpoint"))
        await tx.unsafe(statement);
      const rows = await tx`select *,published_day::text as day from posts`;
      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.id === a)).toMatchObject({
        slug: "existing-link",
        title: "Live",
        day: "2020-01-01",
      });
      expect(rows.find((r) => r.id === b)).toMatchObject({
        title: "",
        paragraph_one: "",
        day: "2024-02-29",
        version: 1,
      });
      expect(rows.find((r) => r.id === c)).toMatchObject({
        title: "Backfill",
        paragraph_one: "Saved text",
        day: "2022-05-03",
      });
      expect(
        rows.every((r) => r.slug && r.published_at && !("published" in r)),
      ).toBe(true);
      expect(
        (await tx`select * from post_images where id=${image}`)[0],
      ).toMatchObject({ post_id: b, active: true });
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
