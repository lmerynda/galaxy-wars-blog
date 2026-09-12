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
  slug: string | null;
  title: string;
  paragraph_one: string;
  paragraph_two: string;
  video_id: string | null;
  video_ids: string[];
  published: boolean;
  published_at: Date | null;
  published_day: string | null;
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
  "id, slug, title, paragraph_one, paragraph_two, video_id, video_ids, published, published_at, published_day::text as published_day, version";
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
    published: r.published,
    publishedAt: r.published_at?.toISOString() ?? null,
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
    from posts where published group by published_day
    order by published_day desc limit 13 offset ${(page - 1) * 12}`;
  const days = summaries.slice(0, 12);
  const covers = days.length
    ? await withImages(
        await sql<PostRow[]>`
    select distinct on (posts.published_day) ${sql.unsafe(fields)} from posts
    where published and published_day in ${sql(days.map((day) => day.day))}
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
    select ${sql.unsafe(fields)} from posts where published and published_day = ${day}
    order by published_at desc, id desc`,
  );
  return posts.length ? { day, posts } : null;
}
export async function publicPost(slug: string) {
  const sql = db();
  const rows = await sql<
    PostRow[]
  >`select ${sql.unsafe(fields)} from posts where published and slug = ${slug}`;
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
export async function createPost(token?: string) {
  await requireOwner(token);
  const [row] = await db()`insert into posts default values returning id`;
  return row.id as string;
}
export async function savePost(
  token: OwnerCredential,
  input: unknown,
  transaction?: TransactionSql,
) {
  await requireOwner(token);
  const data = validatePost(input);
  const apply = async (tx: TransactionSql) => {
    const [post] =
      await tx`select * from posts where id = ${data.id} for update`;
    if (!post) throw new InputError("This post no longer exists.");
    if (post.version !== data.version)
      throw new InputError(
        "This post changed in another tab. Copy your edits, then reload before saving.",
      );
    if (post.published && data.intent === "draft")
      throw new InputError(
        "Use Save changes or Unpublish for a published post.",
      );
    const ids = data.images.map((image) => image.id);
    // Lock pending-object markers before images so maintenance cannot delete a selected upload.
    if (ids.length)
      await tx`select object_key from storage_cleanup where object_key in (select object_key from post_images where id in ${tx(ids)}) order by object_key for update`;
    const selected = ids.length
      ? await tx`select * from post_images where post_id = ${data.id} and id in ${tx(ids)} for update`
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
      await tx`update post_images set active = true, alt = ${alt}, position = ${position} where id = ${image.id}`;
      await tx`delete from storage_cleanup where object_key = ${image.object_key}`;
    }
    for (const image of old.filter((i) => !ids.includes(i.id))) {
      await tx`insert into storage_cleanup (object_key, not_before) values (${image.object_key}, now() + interval '24 hours') on conflict (object_key) do nothing`;
    }
    let slug = post.slug as string | null;
    if (!slug && data.intent === "publish") {
      // Serialize slug allocation to make title collisions safe across concurrent owners/tabs.
      await tx`select pg_advisory_xact_lock(78234622)`;
      slug = slugBase(data.title);
      if ((await tx`select id from posts where slug = ${slug}`).length)
        slug = `${slug}-${randomUUID().slice(0, 8)}`;
    }
    const publishedAt =
      post.published_at ?? (data.intent === "publish" ? new Date() : null);
    const publishedDay =
      data.publishedDay ||
      post.published_day ||
      (publishedAt
        ? publicationDay(publishedAt, process.env.BLOG_TIME_ZONE || undefined)
        : null);
    await tx`update posts set title = ${data.title}, paragraph_one = ${data.paragraphOne}, paragraph_two = ${data.paragraphTwo}, video_id = ${data.videoId}, video_ids = ${tx.array(data.videoIds)},
      slug = ${slug}, published = ${data.intent === "publish"},
      published_at = ${publishedAt}, published_day = ${publishedDay}, updated_at = now(), version = version + 1 where id = ${data.id}`;
  };
  if (transaction) await apply(transaction);
  else await db().begin(apply);
  return (await ownerPost(data.id, token, transaction ?? db()))!;
}
