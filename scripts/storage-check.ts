import "dotenv/config";
import { checkStorage } from "../src/server/storage";
checkStorage()
  .then(() => console.log("Bucket access verified."))
  .catch(() => {
    console.error("Bucket access failed. Check S3 variables and credentials.");
    process.exitCode = 1;
  });
