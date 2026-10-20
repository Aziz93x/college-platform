import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import config, { webServer } from "../../playwright.config";
import { screenProjects } from "./options";

const root = join(import.meta.dirname, "../..");

// pnpm e2e:screens (e2e/screens/options.ts). Only files ending in .screens.ts run here, and
// pnpm test:e2e never runs them.
export default defineConfig({
  testDir: ".",
  testMatch: "*.screens.ts",
  outputDir: join(root, "test-results/screens"),
  fullyParallel: true,
  reporter: "list",
  use: config.use,
  projects: screenProjects,
  webServer: { ...webServer, cwd: root },
});
