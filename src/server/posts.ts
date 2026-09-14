import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import type { Sql, TransactionSql } from "postgres";
import { requireOwner, type OwnerCredential } from "./auth";
import { isDay, publicationDay } from "../lib/day";
import {
  InputError,
  slugBase,
  validatePost,
  type Post,
  type PostImage,
} from "../lib/post";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  paragraph_one: string;
  paragraph_two: string;
  video_id: string | null;
  video_ids: string[];
  published_at: Date;
  published_day: string;
  version: number;
};
type ImageRow = {
  id: string;
  post_id: string;
  role: "before" | "after" | "gallery";
  width: number;
  height: number;
  alt: string;
};
const fields =
  "id, slug, title, paragraph_one, paragraph_two, video_id, video_ids, published_at, published_day::text as published_day, version";
async function withImages(
  rows: PostRow[],
  sql: Sql | TransactionSql = db(),
): Promise<Post[]> {
  if (!rows.length) return [];
  const images = await sql<
    ImageRow[]
  >`select id, post_id, role, width, height, alt from post_images where active and post_id in ${sql(rows.map((p) => p.id))} order by position, id`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    paragraphOne: r.paragraph_one,
    paragraphTwo: r.paragraph_two,
    videoId: r.video_id,
    videoIds: r.video_ids,
    publishedAt: r.published_at.toISOString(),
    publishedDay: r.published_day,
    version: r.version,
    images: images
      .filter((i) => i.post_id === r.id)
      .map((i): PostImage => ({
        id: i.id,
        role: i.role,
        url: `/media/${i.id}`,
        width: i.width,
        height: i.height,
        alt: i.alt,
      })),
  }));
}
export async function publicDays(page = 1) {
  const sql = db();
  const summaries = await sql<
    { day: string; count: number; titles: string[] }[]
  >`
    select published_day::text as day, count(*)::int as count,
      (array_agg(title order by published_at desc, id desc))[1:3] as titles
    from posts group by published_day
    order by published_day desc limit 13 offset ${(page - 1) * 12}`;
  const days = summaries.slice(0, 12);
  const covers = days.length
    ? await withImages(
        await sql<PostRow[]>`
    select distinct on (posts.published_day) ${sql.unsafe(fields)} from posts
    where published_day in ${sql(days.map((day) => day.day))}
    order by posts.published_day desc, published_at desc, id desc`,
      )
    : [];
  return {
    days: days.map((day) => ({
      ...day,
      image: covers
        .find((post) => post.publishedDay === day.day)
        ?.images.at(-1),
    })),
    hasMore: summaries.length > 12,
  };
}
export async function publicDay(day: string) {
  if (!isDay(day)) return null;
  const sql = db();
  const posts = await withImages(
    await sql<PostRow[]>`
    select ${sql.unsafe(fields)} from posts where published_day = ${day}
    order by published_at desc, id desc`,
  );
  return posts.length ? { day, posts } : null;
}
export async function publicPost(slug: string) {
  const sql = db();
  const rows = await sql<
    PostRow[]
  >`select ${sql.unsafe(fields)} from posts where slug = ${slug}`;
  return (await withImages(rows))[0] ?? null;
}
export async function ownerPosts(token?: string) {
  await requireOwner(token);
  const sql = db();
  return withImages(
    await sql<
      PostRow[]
    >`select ${sql.unsafe(fields)} from posts order by updated_at desc`,
  );
}
export async function ownerPost(
  id: string,
  token?: OwnerCredential,
  sql: Sql | TransactionSql = db(),
) {
  await requireOwner(token);
  if (!z.uuid().safeParse(id).success) return null;
  return (
    (
      await withImages(
        await sql<
          PostRow[]
        >`select ${sql.unsafe(fields)} from posts where id = ${id}`,
        sql,
      )
    )[0] ?? null
  );
}
export async function createPost(
  token: OwnerCredential,
  input: Record<string, unknown>,
  transaction?: TransactionSql,
) {
  return savePost(
    token,
    { ...input, id: randomUUID(), version: 0 },
    transaction,
    true,
  );
}
export async function savePost(
  token: OwnerCredential,
  input: unknown,
  transaction?: TransactionSql,
  creating = false,
) {
  await requireOwner(token);
  const data = validatePost(input);
  const apply = async (tx: TransactionSql) => {
    // Serialize a new browser entry ID as well as edits so retries cannot create duplicates.
    await tx`select pg_advisory_xact_lock(hashtextextended(${data.id}, 2))`;
    let [post] = await tx`select * from posts where id = ${data.id} for update`;
    if (creating && !post) {
      const at = new Date();
      const day =
        data.publishedDay ||
        publicationDay(at, process.env.BLOG_TIME_ZONE || undefined);
      const slug = `${slugBase(data.title)}-${data.id}`;
      [post] =
        await tx`insert into posts (id, slug, published_at, published_day) values (${data.id}, ${slug}, ${at}, ${day}) returning *`;
    }
    if (!post) throw new InputError("This post no longer exists.");
    if (post.version !== data.version)
      throw new InputError(
        "This post changed in another tab. Copy your edits, then reload before saving.",
      );
    const ids = data.images.map((image) => image.id);
    // Lock pending-object markers before images so maintenance cannot delete a selected upload.
    if (ids.length)
      await tx`select object_key from storage_cleanup where object_key in (select object_key from post_images where id in ${tx(ids)}) order by object_key for update`;
    const selected = ids.length
      ? await tx`select * from post_images where (post_id = ${data.id} or post_id is null) and id in ${tx(ids)} order by id for update`
      : [];
    if (selected.length !== ids.length)
      throw new InputError(
        "A selected screenshot has expired or does not belong to this post. Upload it again.",
      );
    for (const role of ["before", "after"] as const) {
      const id = data[`${role}Id`];
      if (
        data.legacyImages &&
        id &&
        !selected.some((i) => i.id === id && i.role === role)
      )
        throw new InputError(
          "A selected screenshot has expired or does not belong to this post. Upload it again.",
        );
    }
    const old =
      await tx`select * from post_images where post_id = ${data.id} and active for update`;
    await tx`update post_images set active = false where post_id = ${data.id} and active`;
    for (const image of selected) {
      const position = ids.indexOf(image.id);
      const alt = data.images[position].alt;
      await tx`update post_images set post_id = ${data.id}, active = true, alt = ${alt}, position = ${position} where id = ${image.id}`;
      await tx`delete from storage_cleanup where object_key = ${image.object_key}`;
    }
    for (const image of old.filter((i) => !ids.includes(i.id))) {
      await tx`insert into storage_cleanup (object_key, not_before) values (${image.object_key}, now() + interval '24 hours') on conflict (object_key) do nothing`;
    }
    const publishedDay = data.publishedDay || post.published_day;
    await tx`update posts set title = ${data.title}, paragraph_one = ${data.paragraphOne}, paragraph_two = ${data.paragraphTwo}, video_id = ${data.videoId}, video_ids = ${tx.array(data.videoIds)},
      published_day = ${publishedDay}, updated_at = now(), version = version + 1 where id = ${data.id}`;
  };
  if (transaction) await apply(transaction);
  else await db().begin(apply);
  return (await ownerPost(data.id, token, transaction ?? db()))!;
}
