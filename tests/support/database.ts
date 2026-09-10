import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { deleteObject } from "../../src/server/storage";

// Test setup is deliberately restricted to the blog's local Docker instance.
export async function prepareTestDatabase(
  name: "galaxy_wars_blog_test" | "galaxy_wars_blog_e2e",
) {
  const source = new URL(
    process.env.DATABASE_URL ??
      "postgres://blog:local-blog-password@localhost:5548/galaxy_wars_blog",
  );
  if (
    !["localhost", "127.0.0.1"].includes(source.hostname) ||
    source.port !== "5548" ||
    ![
      "/galaxy_wars_blog",
      "/galaxy_wars_blog_test",
      "/galaxy_wars_blog_e2e",
    ].includes(source.pathname)
  )
    throw new Error(
      "Tests require the blog's dedicated local database on port 5548.",
    );
  source.pathname = "/postgres";
  const admin = postgres(source.toString(), { max: 1 });
  try {
    if (
      !(await admin`select 1 from pg_database where datname = ${name}`).length
    )
      await admin`create database ${admin(name)}`;
  } finally {
    await admin.end();
  }
  source.pathname = `/${name}`;
  const sql = postgres(source.toString(), { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    const oldObjects =
      await sql`select object_key from post_images union select object_key from storage_cleanup`;
    for (const object of oldObjects) await deleteObject(object.object_key);
    await sql`truncate posts, post_images, storage_cleanup, admin_sessions, login_attempts cascade`;
  } finally {
    await sql.end();
  }
  process.env.DATABASE_URL = source.toString();
  return source.toString();
}
