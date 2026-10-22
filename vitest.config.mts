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
        // The server actions it runs import through the @/ alias too.
        resolve: { tsconfigPaths: true },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // Better Auth sets its cookies through next/headers; run through Vitest, it reaches a
          // test's stand-in for it, as a server action's request in the app.
          server: { deps: { inline: ["better-auth"] } },
        },
      },
      {
        // Time budgets (ADR-0023), measured with nothing else running: after the projects above
        // (a later group), one file at a time, on a PostgreSQL of their own. With a single
        // worker, as on two cores, Vitest runs this group first instead; it is alone either way.
        resolve: { tsconfigPaths: true },
        test: {
          name: "budget",
          include: ["tests/budget/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          sequence: { groupOrder: 1 },
          fileParallelism: false,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
