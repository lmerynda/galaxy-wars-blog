import postgres from "postgres";

const globalDb = globalThis as unknown as {
  blogSql?: ReturnType<typeof postgres>;
};
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (globalDb.blogSql ??= postgres(process.env.DATABASE_URL, {
    max: 8,
    connect_timeout: 10,
    idle_timeout: 20,
  }));
}
export async function closeDb() {
  if (globalDb.blogSql) {
    await globalDb.blogSql.end();
    delete globalDb.blogSql;
  }
}
