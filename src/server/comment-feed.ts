import { db } from "./db";
export async function commentCount() {
  const [row] =
    await db()`select count(*)::int as count from comments where not hidden`;
  return row.count as number;
}
export async function recentComments(page = 1) {
  const rows =
    await db()`select c.id, c.name, c.body, c.parent_id, c.created_at, p.id as post_id, p.title, p.published_day::text as day
 from comments c join posts p on p.id = c.post_id where not c.hidden
 order by c.created_at desc, c.id desc limit 31 offset ${(page - 1) * 30}`;
  return {
    comments: rows.slice(0, 30).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      body: row.body as string,
      reply: row.parent_id !== null,
      createdAt: (row.created_at as Date).toISOString(),
      postId: row.post_id as string,
      title: row.title as string,
      day: row.day as string,
    })),
    hasMore: rows.length > 30,
  };
}
