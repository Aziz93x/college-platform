import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { PgBoss } from "pg-boss";
import { parseEnv } from "../src/platform/config/env.ts";
import { createDb } from "../src/platform/db/client.ts";

const migrationsFolder = fileURLToPath(new URL("migrations", import.meta.url));

// Applies the reviewed SQL migrations, then installs or upgrades the pg-boss schema, which pg-boss
// keeps in its own pgboss schema. The boss starts without supervision, schedules or an instance row,
// so a re-run writes nothing.
export async function migrateDatabase(url: string) {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
  const boss = new PgBoss({
    connectionString: url,
    supervise: false,
    schedule: false,
    registerInstance: false,
  });
  try {
    await boss.start();
  } finally {
    // Closes the boss's connections even after a failed start.
    await boss.stop();
  }
}

if (import.meta.main) {
  try {
    await migrateDatabase(parseEnv(process.env).DATABASE_URL);
    console.log("db:migrate finished.");
  } catch (error) {
    // Drizzle wraps driver errors, such as a refused connection, in a "Failed query" error.
    const { message, cause } = error as Error;
    console.error(
      `db:migrate failed: ${message}`,
      cause instanceof Error ? cause.message : "",
    );
    process.exit(1);
  }
}
