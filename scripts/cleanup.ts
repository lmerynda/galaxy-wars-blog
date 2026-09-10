import "dotenv/config";
import { cleanupStorage } from "../src/server/images";
import { closeDb } from "../src/server/db";
cleanupStorage()
  .then((result) => {
    console.log(result);
    if (result.failed) process.exitCode = 1;
  })
  .catch(() => {
    console.error("Storage cleanup failed; queued objects will be retried.");
    process.exitCode = 1;
  })
  .finally(closeDb);
