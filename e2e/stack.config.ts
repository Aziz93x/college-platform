import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import config from "../playwright.config";

const root = join(import.meta.dirname, "..");
const SKIPPED = /@database|@visual/;

// The end-to-end smoke against the stack that pnpm local:up --demo started (ADR-0008): Caddy on
// https://localhost with its own certificate. The stack publishes no database port, so the tests that
// make their own accounts in the database (@database) stay in pnpm test:e2e, and stack.smoke.ts runs
// their journey on the demo accounts. The demo's own secrets come from docker/.env. CI runs it on the
// images it loaded from saved archives; on a laptop, start a fresh demo stack (docs/ops/local.md).
const secrets = join(root, "docker/.env");
if (existsSync(secrets)) process.loadEnvFile(secrets);

export default defineConfig({
  ...config,
  testDir: ".",
  testMatch: [
    "audit.spec.ts",
    "auth.setup.ts",
    "auth.spec.ts",
    "axes.spec.ts",
    "departments.spec.ts",
    "framework.spec.ts",
    "health.spec.ts",
    "notifications.spec.ts",
    "people.spec.ts",
    "rayat.spec.ts",
    "roles.spec.ts",
    "security.spec.ts",
    "settings.spec.ts",
    "shell.spec.ts",
    "stack.smoke.ts",
    "terms.spec.ts",
  ],
  grepInvert: SKIPPED,
  outputDir: join(root, "test-results/stack"),
  use: { ...config.use, baseURL: "https://localhost", ignoreHTTPSErrors: true },
  projects: config.projects?.map((project) => ({
    ...project,
    ...(project.grepInvert && { grepInvert: SKIPPED }),
    // Its journey runs once per stack: on the phone, which comes first (docs/PLAN.md section 4).
    ...(project.name === "desktop" && { testIgnore: "stack.smoke.ts" }),
  })),
  webServer: undefined,
});
