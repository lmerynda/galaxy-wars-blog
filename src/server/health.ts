import { db } from "./db";
import { errorDetails } from "./diagnostics";
import { storageConfig } from "./storage";
// Railway's deploy health check: a failure keeps the previous deployment live.
export async function healthResponse() {
  try {
    storageConfig();
    await db()`select id from posts limit 1`;
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error(
      JSON.stringify({ event: "health.failed", error: errorDetails(error) }),
    );
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
