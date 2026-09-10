import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { requireOwner, sessionValid } from "./auth";
import { deleteObject, getObject, putObject } from "./storage";
import { InputError, type PostImage, type Role } from "../lib/post";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export async function inspectImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new InputError("Screenshots must be no larger than 10 MiB.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 32000000,
      animated: true,
      failOn: "warning",
    });
    const meta = await image.metadata();
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const expected = mimeTypes[meta.format ?? ""];
    if (
      !expected ||
      mime !== expected ||
      (meta.pages ?? 1) !== 1 ||
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 32000000
    )
      throw new Error();
    await image.stats(); // Force full decoding, rather than trusting only the header.
    return {
      width: meta.width,
      height: meta.height,
      mime: expected,
      bytes: bytes.length,
    };
  } catch {
    throw new InputError(
      "Choose a valid, still PNG, JPEG, or WebP screenshot up to 32 megapixels.",
    );
  }
}
export async function uploadImage(
  token: string | undefined,
  postId: string,
  role: string,
  bytes: Buffer,
  mime: string,
): Promise<PostImage> {
  await requireOwner(token);
  if (
    !z.uuid().safeParse(postId).success ||
    !["before", "after"].includes(role)
  )
    throw new InputError("Invalid screenshot destination.");
  if (!(await db()`select id from posts where id = ${postId}`).length)
    throw new InputError("This draft no longer exists.");
  const meta = await inspectImage(bytes, mime);
  const id = randomUUID(),
    key = `posts/${postId}/${id}`;
  // A durable marker exists even if the process stops between upload and the image insert.
  await db()`insert into storage_cleanup (object_key, not_before) values (${key}, now() + interval '24 hours')`;
  await putObject(key, bytes, mime);
  await db()`insert into post_images (id, post_id, role, object_key, mime, width, height, bytes) values (${id}, ${postId}, ${role}, ${key}, ${meta.mime}, ${meta.width}, ${meta.height}, ${meta.bytes})`;
  return {
    id,
    role: role as Role,
    url: `/media/${id}`,
    width: meta.width,
    height: meta.height,
    alt: "",
  };
}
export async function readImage(id: string, token?: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] =
    await db()`select i.object_key, i.mime, i.bytes, (p.published and i.active) as public from post_images i join posts p on p.id = i.post_id where i.id = ${id}`;
  if (!row || (!row.public && !(await sessionValid(token)))) return null;
  const result = await getObject(row.object_key);
  return {
    body: result.Body?.transformToWebStream(),
    mime: row.mime as string,
    bytes: row.bytes as number,
  };
}
export async function cleanupStorage() {
  const rows =
    await db()`select object_key from storage_cleanup where not_before < now() order by not_before limit 100`;
  let deleted = 0,
    failed = 0;
  for (const row of rows) {
    try {
      await db().begin(async (tx) => {
        // Lock the marker before deleting. Saving an image takes the same lock.
        const markers =
          await tx`select object_key from storage_cleanup where object_key = ${row.object_key} and not_before < now() for update`;
        if (!markers.length) return;
        const active =
          await tx`select id from post_images where object_key = ${row.object_key} and active`;
        if (!active.length) {
          await deleteObject(row.object_key);
          await tx`delete from post_images where object_key = ${row.object_key} and not active`;
          deleted++;
        }
        await tx`delete from storage_cleanup where object_key = ${row.object_key}`;
      });
    } catch {
      failed++;
      await db()`update storage_cleanup set attempts = attempts + 1, not_before = now() + interval '1 hour' where object_key = ${row.object_key}`;
    }
  }
  return { deleted, failed };
}
