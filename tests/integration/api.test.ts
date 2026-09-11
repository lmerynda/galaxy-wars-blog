import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prepareTestDatabase } from "../support/database";
import { handleApi } from "../../src/server/api";
import { db, closeDb } from "../../src/server/db";
import { deleteObject } from "../../src/server/storage";
import { readImage } from "../../src/server/images";
import { sessionValid } from "../../src/server/auth";

const token = "api-integration-only-" + "a".repeat(64);
const draft = {
  title: "API draft",
  paragraphOne: "Before the change.",
  paragraphTwo: "After the change.",
  youtubeUrl: "",
  beforeId: "",
  afterId: "",
  beforeAlt: "Before",
  afterAlt: "After",
};
function call(
  path: string[],
  method = "POST",
  body: unknown = draft,
  key: string = randomUUID(),
  credential = token,
) {
  return handleApi(
    new Request(`http://localhost/api/v1/${path.join("/")}`, {
      method,
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    }),
    path,
  );
}
beforeAll(async () => {
  await prepareTestDatabase("galaxy_wars_blog_test");
  process.env.BLOG_API_TOKEN = token;
});
afterAll(async () => {
  delete process.env.BLOG_API_TOKEN;
  const objects =
    await db()`select object_key from post_images union select object_key from storage_cleanup`;
  for (const object of objects) await deleteObject(object.object_key);
  await closeDb();
});
it("requires a separate token, fails closed and rejects invalid requests", async () => {
  expect(
    (await call(["posts"], "POST", draft, randomUUID(), "wrong")).status,
  ).toBe(401);
  delete process.env.BLOG_API_TOKEN;
  expect((await call(["posts"])).status).toBe(401);
  process.env.BLOG_API_TOKEN = token;
  expect(await sessionValid(token)).toBe(false);
  expect(
    (await call(["posts"], "POST", { ...draft, intent: "publish" })).status,
  ).toBe(400);
  expect((await call(["posts"], "POST", draft, "short")).status).toBe(400);
  expect(
    (await call(["posts"], "POST", { ...draft, title: "x".repeat(20000) }))
      .status,
  ).toBe(413);
});
it("deduplicates concurrent creates and persists receipts across connection restarts", async () => {
  const key = randomUUID();
  const responses = await Promise.all([
    call(["posts"], "POST", draft, key),
    call(["posts"], "POST", draft, key),
  ]);
  const a = await responses[0].json(),
    b = await responses[1].json();
  expect(a).toEqual(b);
  expect(a.post.published).toBe(false);
  expect(a.previewUrl).toBe(`/admin/posts/${a.post.id}/edit`);
  expect(
    (await call(["posts"], "POST", { ...draft, title: "Different" }, key))
      .status,
  ).toBe(409);
  await closeDb();
  expect(await (await call(["posts"], "POST", draft, key)).json()).toEqual(a);
  const rows = await db()`select id from posts where id = ${a.post.id}`;
  expect(rows).toHaveLength(1);
});
it("rolls back the draft if its retry receipt cannot be saved", async () => {
  const key = randomUUID();
  const body = { ...draft, title: "receipt-rollback" };
  await db()`alter table api_requests add constraint test_receipt_failure check (response->'post'->>'title' <> 'receipt-rollback')`;
  try {
    expect((await call(["posts"], "POST", body, key)).status).toBe(503);
    expect(
      await db()`select id from posts where title = 'receipt-rollback'`,
    ).toHaveLength(0);
    expect(
      await db()`select key from api_requests where key = ${key}`,
    ).toHaveLength(0);
  } finally {
    await db()`alter table api_requests drop constraint test_receipt_failure`;
  }
  expect((await call(["posts"], "POST", body, key)).status).toBe(200);
});
it("uploads privately, saves a draft, publishes explicitly and rejects stale writes", async () => {
  const { post } = await (await call(["posts"])).json();
  expect(
    (
      await call(["posts", post.id, "publish"], "POST", {
        version: post.version,
      })
    ).status,
  ).toBe(400);
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#234567" },
  })
    .png()
    .toBuffer();
  async function upload(role: string, key: string) {
    return handleApi(
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "image/png",
          "idempotency-key": key,
        },
        body: png,
      }),
      ["posts", post.id, "images", role],
    );
  }
  const key = randomUUID();
  const before = await (await upload("before", key)).json();
  expect(await (await upload("before", key)).json()).toEqual(before);
  expect(await readImage(before.image.id)).toBeNull();
  const after = await (await upload("after", randomUUID())).json();
  const input = {
    ...draft,
    version: post.version,
    beforeId: before.image.id,
    afterId: after.image.id,
  };
  const updateKey = randomUUID();
  const saved = await (
    await call(["posts", post.id], "PUT", input, updateKey)
  ).json();
  expect(saved.post.published).toBe(false);
  expect(saved.post.images).toHaveLength(2);
  expect(
    await (await call(["posts", post.id], "PUT", input, updateKey)).json(),
  ).toEqual(saved);
  expect((await call(["posts", post.id], "PUT", input)).status).toBe(409);
  const publishKey = randomUUID();
  const publishBody = { version: saved.post.version };
  const published = await (
    await call(["posts", post.id, "publish"], "POST", publishBody, publishKey)
  ).json();
  expect(published.post.published).toBe(true);
  expect(published.publicUrl).toBe(
    `/days/${published.post.publishedDay}#entry-${post.id}`,
  );
  expect(
    await (
      await call(["posts", post.id, "publish"], "POST", publishBody, publishKey)
    ).json(),
  ).toEqual(published);
  expect(
    (
      await call(["posts", post.id], "PUT", {
        ...input,
        version: published.post.version,
      })
    ).status,
  ).toBe(409);
  const image = await readImage(before.image.id);
  expect(image).not.toBeNull();
  await image?.body?.cancel();
  process.env.BLOG_API_TOKEN = "rotated-" + token;
  expect((await call(["posts", post.id], "GET")).status).toBe(401);
  process.env.BLOG_API_TOKEN = token;
});
