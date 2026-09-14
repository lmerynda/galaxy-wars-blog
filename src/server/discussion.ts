import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { requireOwner, type OwnerCredential } from "./auth";
import { InputError } from "../lib/post";
import type { DiscussionData, Poll } from "../lib/discussion";

async function requirePost(id: string, owner?: OwnerCredential) {
  if (!z.uuid().safeParse(id).success)
    throw new InputError("Update not found.");
  if (owner) await requireOwner(owner);
  const [post] = await db()`select id from posts where id = ${id}`;
  if (!post) throw new InputError("Update not found.");
}
export async function discussion(
  id: string,
  voter: string,
  owner?: OwnerCredential,
): Promise<DiscussionData> {
  await requirePost(id, owner);
  const comments =
    await db()`select id, parent_id, name, body, hidden, created_at from comments where post_id = ${id} order by created_at, id`;
  const [row] = await db()`select * from polls where post_id = ${id}`;
  let poll: Poll | null = null;
  if (row) {
    const counts =
      await db()`select option_id, count(*)::int as count from poll_votes where poll_id = ${row.id} group by option_id`;
    const [selection] =
      await db()`select option_id from poll_votes where poll_id = ${row.id} and voter = ${voter}`;
    const options = (row.options as { id: string; label: string }[]).map(
      (option) => ({
        ...option,
        count: counts.find((c) => c.option_id === option.id)?.count ?? 0,
      }),
    );
    poll = {
      id: row.id,
      question: row.question,
      options,
      closed: row.closed,
      version: row.version,
      total: options.reduce((sum, o) => sum + o.count, 0),
      selected: selection?.option_id ?? null,
    };
  }
  return {
    comments: comments.map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.hidden ? "" : c.name,
      body: c.hidden ? "" : c.body,
      hidden: c.hidden,
      createdAt: c.created_at.toISOString(),
    })),
    poll,
  };
}
export async function addComment(
  postId: string,
  input: unknown,
  client: string,
) {
  const data = z
    .object({
      id: z.uuid(),
      parentId: z.uuid().nullable(),
      name: z.string().trim().min(1).max(60),
      body: z.string().trim().min(1).max(3000),
    })
    .parse(input);
  await db().begin(async (tx) => {
    if (!z.uuid().safeParse(postId).success)
      throw new InputError("Update not found.");
    const [post] =
      await tx`select id from posts where id = ${postId} for share`;
    if (!post) throw new InputError("Update not found.");
    // Same client retries are serialized; successful retry IDs do not consume the limit.
    await tx`select pg_advisory_xact_lock(hashtextextended(${client}, 1))`;
    const [existing] = await tx`select * from comments where id = ${data.id}`;
    if (existing) {
      if (
        existing.post_id !== postId ||
        existing.parent_id !== data.parentId ||
        existing.name !== data.name ||
        existing.body !== data.body
      )
        throw new InputError("This comment request was already used.");
      return;
    }
    if (
      data.parentId &&
      !(
        await tx`select id from comments where id = ${data.parentId} and post_id = ${postId}`
      ).length
    )
      throw new InputError("Reply not found in this update.");
    const key = `comments:${client}`;
    const [attempt] =
      await tx`select count from login_attempts where key = ${key} and expires_at > now()`;
    if (attempt?.count >= 10)
      throw new InputError(
        "Too many comments. Please try again in 15 minutes.",
      );
    await tx`insert into login_attempts (key,count,expires_at) values (${key},1,now()+interval '15 minutes') on conflict (key) do update set count = case when login_attempts.expires_at <= now() then 1 else login_attempts.count+1 end, expires_at = case when login_attempts.expires_at <= now() then now()+interval '15 minutes' else login_attempts.expires_at end`;
    await tx`insert into comments (id,post_id,parent_id,name,body) values (${data.id},${postId},${data.parentId},${data.name},${data.body})`;
  });
}
export async function vote(postId: string, optionId: string, voter: string) {
  if (
    !z.uuid().safeParse(postId).success ||
    !z.uuid().safeParse(optionId).success ||
    !voter
  )
    throw new InputError("Invalid vote.");
  await db().begin(async (tx) => {
    const [post] =
      await tx`select id from posts where id = ${postId} for share`;
    if (!post) throw new InputError("Update not found.");
    const [poll] =
      await tx`select * from polls where post_id = ${postId} for update`;
    if (!poll || poll.closed) throw new InputError("Voting is closed.");
    if (!(poll.options as { id: string }[]).some((o) => o.id === optionId))
      throw new InputError("Choose an option in this poll.");
    await tx`insert into poll_votes (poll_id,voter,option_id) values (${poll.id},${voter},${optionId}) on conflict (poll_id,voter) do update set option_id = excluded.option_id`;
  });
}
export async function savePoll(
  owner: OwnerCredential,
  postId: string,
  input: unknown,
) {
  await requireOwner(owner);
  const data = z
    .object({
      version: z.number().int().nonnegative(),
      question: z.string().trim().min(1).max(200),
      options: z.array(z.string().trim().min(1).max(200)).min(2).max(12),
      closed: z.boolean(),
    })
    .parse(input);
  if (
    new Set(data.options.map((o) => o.toLowerCase())).size !==
    data.options.length
  )
    throw new InputError("Give each choice a different label.");
  await db().begin(async (tx) => {
    if (
      !z.uuid().safeParse(postId).success ||
      !(await tx`select id from posts where id = ${postId} for update`).length
    )
      throw new InputError("Update not found.");
    const [poll] =
      await tx`select * from polls where post_id = ${postId} for update`;
    if ((poll?.version ?? 0) !== data.version)
      throw new InputError("Poll changed. Reload before saving.");
    const old = poll?.options as { id: string; label: string }[] | undefined;
    const unchanged =
      poll &&
      poll.question === data.question &&
      JSON.stringify(old?.map((o) => o.label)) === JSON.stringify(data.options);
    if (
      poll &&
      !unchanged &&
      (await tx`select 1 from poll_votes where poll_id = ${poll.id} limit 1`)
        .length
    )
      throw new InputError(
        "A poll with votes keeps its question and choices. You can close voting.",
      );
    const options = data.options.map((label, index) => ({
      id: unchanged ? old![index].id : randomUUID(),
      label,
    }));
    await tx`insert into polls (post_id,question,options,closed,version) values (${postId},${data.question},${tx.json(options)},${data.closed},1) on conflict (post_id) do update set question=excluded.question,options=excluded.options,closed=excluded.closed,version=polls.version+1`;
  });
}
export async function moderateComment(
  owner: OwnerCredential,
  postId: string,
  id: string,
  hidden: boolean,
) {
  await requireOwner(owner);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(postId).success ||
    typeof hidden !== "boolean"
  )
    throw new InputError("Comment not found.");
  await db()`update comments set hidden = ${hidden} where id = ${id} and post_id = ${postId}`;
}
