import { commentCount, recentComments } from "../../src/server/comment-feed";
import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prepareTestDatabase } from "../support/database";
import { closeDb, db } from "../../src/server/db";
import { createPost, savePost, ownerPost } from "../../src/server/posts";
import { uploadImage, readImage } from "../../src/server/images";
import { login } from "../../src/server/auth";
import { hashPassword } from "../../src/server/password";
import { deleteObject } from "../../src/server/storage";
import {
  addComment,
  discussion,
  moderateComment,
  savePoll,
  vote,
} from "../../src/server/discussion";
let owner: string;
const content = {
  title: "Design choices",
  paragraphOne: "The original design.",
  paragraphTwo: "Three possible improvements.",
  youtubeUrl: "",
  beforeId: "",
  afterId: "",
  beforeAlt: "",
  afterAlt: "",
  images: [],
};
beforeAll(async () => {
  await prepareTestDatabase("galaxy_wars_blog_test");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(
    "discussion-test-password",
  );
  owner = await login("discussion-test-password", "discussion-tests");
});
afterAll(async () => {
  const keys =
    await db()`select object_key from post_images union select object_key from storage_cleanup`;
  for (const row of keys) await deleteObject(row.object_key);
  await closeDb();
});
async function entry() {
  return createPost(owner, content);
}

it("saves galleries of more than two images, preserves order, and keeps removed images private", async () => {
  const post = await entry();
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#456789" },
  })
    .png()
    .toBuffer();
  const images = [];
  for (let i = 0; i < 4; i++)
    images.push(await uploadImage(owner, png, "image/png"));
  const selections = images
    .slice()
    .reverse()
    .map((image, index) => ({ id: image.id, alt: `Proposal ${index + 1}` }));
  let saved = await savePost(owner, {
    ...content,
    id: post.id,
    version: post.version,
    images: selections,
  });
  expect(saved.images.map((i) => i.id)).toEqual(selections.map((i) => i.id));
  const foreign = await entry();
  await expect(
    savePost(owner, {
      ...content,
      id: foreign.id,
      version: foreign.version,
      images: selections,
    }),
  ).rejects.toThrow(/does not belong/);
  await expect(
    savePost(owner, {
      ...content,
      id: post.id,
      version: saved.version,
      images: [selections[0], selections[0]],
    }),
  ).rejects.toThrow(/only once/);
  saved = await savePost(owner, {
    ...content,
    id: post.id,
    version: saved.version,
    images: selections.slice(1),
  });
  expect(saved.images).toHaveLength(3);
  expect(await readImage(selections[0].id)).toBeNull();
  expect((await ownerPost(post.id, owner))?.images[0].alt).toBe("Proposal 2");
});
it("supports nested same-entry replies, retry deduplication, moderation and missing-entry protection", async () => {
  const post = await entry(),
    other = await entry(),
    missing = { id: randomUUID() };
  const parent = {
    id: randomUUID(),
    parentId: null,
    name: "Pilot",
    body: "I prefer proposal A.",
  };
  await Promise.all([
    addComment(post.id, parent, "pilot"),
    addComment(post.id, parent, "pilot"),
  ]);
  const reply = {
    ...parent,
    id: randomUUID(),
    parentId: parent.id,
    body: "Why that one?",
  };
  await addComment(post.id, reply, "another-pilot");
  await expect(
    addComment(other.id, { ...reply, id: randomUUID() }, "other"),
  ).rejects.toThrow(/Reply not found/);
  await expect(
    addComment(missing.id, { ...parent, id: randomUUID() }, "other"),
  ).rejects.toThrow(/not found/);
  await expect(discussion(missing.id, "")).rejects.toThrow(/not found/);
  await expect(
    moderateComment(undefined, post.id, parent.id, true),
  ).rejects.toThrow(/sign in/);
  await moderateComment(owner, post.id, parent.id, true);
  const data = await discussion(post.id, "");
  expect(data.comments).toHaveLength(2);
  expect(data.comments[0]).toMatchObject({ hidden: true, body: "", name: "" });
  expect(data.comments[1].parentId).toBe(parent.id);
  await moderateComment(owner, post.id, parent.id, false);
  expect((await discussion(post.id, "")).comments[0].body).toBe(parent.body);
  for (let i = 0; i < 10; i++)
    await addComment(post.id, { ...parent, id: randomUUID() }, "limited-pilot");
  await expect(
    addComment(post.id, { ...parent, id: randomUUID() }, "limited-pilot"),
  ).rejects.toThrow(/Too many/);
});
it("counts one changeable vote per browser and freezes choices after voting", async () => {
  const post = await entry();
  const config = {
    version: 0,
    question: "Which design?",
    options: ["Proposal A", "Proposal B", "Proposal C"],
    closed: false,
  };
  await expect(savePoll(undefined, post.id, config)).rejects.toThrow(/sign in/);
  await savePoll(owner, post.id, config);
  let poll = (await discussion(post.id, "")).poll!;
  await expect(vote(post.id, randomUUID(), "browser-a")).rejects.toThrow(
    /Choose an option/,
  );
  await Promise.all([
    vote(post.id, poll.options[0].id, "browser-a"),
    vote(post.id, poll.options[0].id, "browser-a"),
  ]);
  await vote(post.id, poll.options[1].id, "browser-a");
  await vote(post.id, poll.options[2].id, "browser-b");
  poll = (await discussion(post.id, "browser-a")).poll!;
  expect(poll.total).toBe(2);
  expect(poll.options.map((o) => o.count)).toEqual([0, 1, 1]);
  expect(poll.selected).toBe(poll.options[1].id);
  await expect(
    savePoll(owner, post.id, {
      ...config,
      version: poll.version,
      options: ["New A", "New B"],
    }),
  ).rejects.toThrow(/with votes/);
  await savePoll(owner, post.id, {
    ...config,
    version: poll.version,
    closed: true,
  });
  await expect(vote(post.id, poll.options[0].id, "browser-c")).rejects.toThrow(
    /closed/,
  );
  await closeDb();
  expect((await discussion(post.id, "browser-a")).poll?.total).toBe(2);
});

it("counts comments and replies globally while excluding hidden content from the feed", async () => {
  const before = await commentCount();
  const post = await entry();
  const ids: string[] = [];
  for (let i = 0; i < 32; i++) {
    const id = randomUUID();
    ids.push(id);
    await db()`insert into comments(id,post_id,parent_id,name,body,created_at) values (${id},${post.id},${i === 1 ? ids[0] : null},'Feed reader',${"Feedback " + i},${new Date(Date.UTC(2099, 0, 1, 0, 0, i))})`;
  }
  expect(await commentCount()).toBe(before + 32);
  const first = await recentComments();
  expect(first.comments).toHaveLength(30);
  expect(first.hasMore).toBe(true);
  expect(first.comments[0].id).toBe(ids[31]);
  const second = await recentComments(2);
  expect(second.comments[0]).toMatchObject({
    id: ids[1],
    reply: true,
    postId: post.id,
  });
  await moderateComment(owner, post.id, ids[31], true);
  expect(await commentCount()).toBe(before + 31);
  expect((await recentComments()).comments.some((c) => c.id === ids[31])).toBe(
    false,
  );
  await moderateComment(owner, post.id, ids[31], false);
  expect(await commentCount()).toBe(before + 32);
});
