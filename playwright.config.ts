import { defineConfig, devices } from "@playwright/test";

const port = 3000;

// e2e/screens/screens.config.ts runs the same server.
export const webServer = {
  // CI tests the standalone build that the app image runs; the laptop tests the dev server.
  command: process.env.CI
    ? "node .next/standalone/server.js"
    : `pnpm dev --port ${port}`,
  // The standalone server binds to HOSTNAME, which CI runners set to the machine name.
  env: { PORT: String(port), HOSTNAME: "localhost" },
  url: `http://localhost:${port}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Visual baselines come from CI's Chromium (e2e/design.visual.spec.ts); a laptop skips them.
  grepInvert: process.env.CI ? undefined : /@visual/,
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "ar-SA",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone",
      use: { ...devices["iPhone 15"], browserName: "chromium" },
      // Visual baselines are taken once, in the desktop project, at each width.
      grepInvert: /@visual/,
    },
  ],
  webServer,
});
