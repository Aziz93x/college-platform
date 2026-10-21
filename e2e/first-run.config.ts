import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import config from "../playwright.config";

const root = join(import.meta.dirname, "..");

// The owner's first run on the production-like stack that pnpm local:up started (docs/ops/local.md):
// CI's stack job runs pnpm local:run admin:create there and hands first-run.stack.ts the temporary
// password it printed. The run changes that password, so it has no retry, and runs once per stack.
export default defineConfig({
  ...config,
  testDir: ".",
  testMatch: "first-run.stack.ts",
  retries: 0,
  outputDir: join(root, "test-results/first-run"),
  use: { ...config.use, baseURL: "https://localhost", ignoreHTTPSErrors: true },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: undefined,
});
