import { defineConfig } from "drizzle-kit";

// Each module owns its tables in server/schema.ts; pnpm db:generate writes SQL to review in the PR.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/server/schema.ts",
  out: "./db/migrations",
});
