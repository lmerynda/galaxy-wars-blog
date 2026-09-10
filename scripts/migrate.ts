import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, closeDb } from "../src/server/db";
async function main() {
  try {
    await migrate(drizzle(db()), { migrationsFolder: "drizzle" });
    console.log("Migrations applied.");
  } finally {
    await closeDb();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check database connectivity and committed migrations.",
  );
  process.exitCode = 1;
});
