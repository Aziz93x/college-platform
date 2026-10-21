import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A module kept from an earlier run keeps what its import.meta.glob found then, so a guard such
    // as the permission matrix would miss an action file added since (Audit 3). CI starts without
    // one; this keeps a laptop's run the same.
    fsModuleCache: false,
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
