import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { requireOwner } from "./auth";
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
  published: boolean;
  published_at: Date | null;
  version: number;
};
type ImageRow = {
  id: string;
  post_id: string;
  role: "before" | "after";
  width: number;
  height: number;
  alt: string;
};
const fields =
  "id, slug, title, paragraph_one, paragraph_two, video_id, published, published_at, version";
async function withImages(rows: PostRow[]): Promise<Post[]> {
  if (!rows.length) return [];
  const sql = db();
  const images = await sql<
    ImageRow[]
  >`select id, post_id, role, width, height, alt from post_images where active and post_id in ${sql(rows.map((p) => p.id))}`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    paragraphOne: r.paragraph_one,
    paragraphTwo: r.paragraph_two,
    videoId: r.video_id,
    published: r.published,
    publishedAt: r.published_at?.toISOString() ?? null,
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
export async function publicPosts(page = 1) {
  const sql = db();
  const rows = await sql<
    PostRow[]
  >`select ${sql.unsafe(fields)} from posts where published order by published_at desc, id desc limit 13 offset ${(page - 1) * 12}`;
  return {
    posts: await withImages(rows.slice(0, 12)),
    hasMore: rows.length > 12,
  };
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
export async function ownerPost(id: string, token?: string) {
  await requireOwner(token);
  if (!z.uuid().safeParse(id).success) return null;
  const sql = db();
  return (
    (
      await withImages(
        await sql<
          PostRow[]
        >`select ${sql.unsafe(fields)} from posts where id = ${id}`,
      )
    )[0] ?? null
  );
}
export async function createPost(token?: string) {
  await requireOwner(token);
  const [row] = await db()`insert into posts default values returning id`;
  return row.id as string;
}
export async function savePost(token: string | undefined, input: unknown) {
  await requireOwner(token);
  const data = validatePost(input);
  await db().begin(async (tx) => {
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
    const ids = [data.beforeId, data.afterId].filter(Boolean);
    // Lock pending-object markers before images so maintenance cannot delete a selected upload.
    if (ids.length)
      await tx`select object_key from storage_cleanup where object_key in (select object_key from post_images where id in ${tx(ids)}) order by object_key for update`;
    const selected = ids.length
      ? await tx`select * from post_images where post_id = ${data.id} and id in ${tx(ids)} for update`
      : [];
    for (const role of ["before", "after"] as const) {
      const id = data[`${role}Id`];
      if (id && !selected.some((i) => i.id === id && i.role === role))
        throw new InputError(
          "A selected screenshot has expired or does not belong to this post. Upload it again.",
        );
    }
    const old =
      await tx`select * from post_images where post_id = ${data.id} and active for update`;
    await tx`update post_images set active = false where post_id = ${data.id} and active`;
    for (const image of selected) {
      const alt = image.role === "before" ? data.beforeAlt : data.afterAlt;
      await tx`update post_images set active = true, alt = ${alt} where id = ${image.id}`;
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
    await tx`update posts set title = ${data.title}, paragraph_one = ${data.paragraphOne}, paragraph_two = ${data.paragraphTwo}, video_id = ${data.videoId},
      slug = ${slug}, published = ${data.intent === "publish"},
      published_at = ${post.published_at ?? (data.intent === "publish" ? new Date() : null)}, updated_at = now(), version = version + 1 where id = ${data.id}`;
  });
  return (await ownerPost(data.id, token))!;
}
