import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  // One dedicated connection keeps the migration timezone on the same session.
  const connection = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
  });
  try {
    await connection`select set_config('blog.time_zone', ${process.env.BLOG_TIME_ZONE || "America/Chicago"}, false)`;
    await migrate(drizzle(connection), { migrationsFolder: "drizzle" });
    console.log("Migrations applied.");
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check database connectivity and committed migrations.",
  );
  process.exitCode = 1;
});
