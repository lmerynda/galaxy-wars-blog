import "dotenv/config";
import { defineConfig } from "@playwright/test";
import { scryptSync } from "node:crypto";

const salt = "0123456789abcdef0123456789abcdef";
// This credential belongs exclusively to the disposable local E2E database.
const hash = `scrypt:${salt}:${scryptSync("local-e2e-password-only", salt, 64).toString("hex")}`;
// Windows can reserve 3018 (Hyper-V port ranges); override with E2E_PORT.
process.env.E2E_PORT ??= "3018";
const origin = `http://localhost:${process.env.E2E_PORT}`;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: origin,
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      APP_URL: origin,
      ADMIN_PASSWORD_HASH: hash,
      TRUST_RAILWAY_PROXY: "false",
    },
  },
});
