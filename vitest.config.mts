import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Routes import through the @/ alias from tsconfig.json.
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
        },
      },
      {
        // Real PostgreSQL through Testcontainers, so it needs Docker; each file gets its own database.
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
