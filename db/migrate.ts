import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { PgBoss } from "pg-boss";
import { parseMigrateEnv } from "../src/platform/config/env.ts";
import { createDb } from "../src/platform/db/client.ts";

const migrationsFolder = fileURLToPath(new URL("migrations", import.meta.url));

// The role the app and the worker connect as, named by APP_DATABASE_URL. It neither owns the tables
// nor is a superuser, so the audit log's triggers bind it (docs/PLAN.md, Step 41). It reads and
// writes the rows of the platform's tables and of pg-boss's, those of later migrations included, but
// for the audit log's, which it only adds to, and changes no table, schema or trigger. Its password
// follows the URL on every run.
export async function grantAppRole(ownerUrl: string, appUrl: string) {
  const app = new URL(appUrl);
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const role = decodeURIComponent(app.username);
    const name = client.escapeIdentifier(role);
    const { rowCount } = await client.query(
      "select 1 from pg_roles where rolname = $1",
      [role],
    );
    await client.query(
      `${rowCount ? "alter" : "create"} role ${name} login nosuperuser nocreatedb nocreaterole nobypassrls password ${client.escapeLiteral(decodeURIComponent(app.password))}`,
    );
    for (const schema of ["public", "pgboss"]) {
      const target = client.escapeIdentifier(schema);
      await client.query(`grant usage on schema ${target} to ${name}`);
      await client.query(
        `grant select, insert, update, delete on all tables in schema ${target} to ${name}`,
      );
      await client.query(
        `grant usage, select on all sequences in schema ${target} to ${name}`,
      );
      await client.query(
        `alter default privileges in schema ${target} grant select, insert, update, delete on tables to ${name}`,
      );
      await client.query(
        `alter default privileges in schema ${target} grant usage, select on sequences to ${name}`,
      );
    }
    // History is append-only: the role adds and reads events, and removes old ones only through the
    // retention purge, which keeps at least a year (migration 0010).
    await client.query(
      `revoke update, delete on public.audit_events from ${name}`,
    );
    await client.query(
      `grant execute on function public.purge_audit_events(uuid, integer) to ${name}`,
    );
  } finally {
    await client.end();
  }
}

// Applies the reviewed SQL migrations, then installs or upgrades the pg-boss schema, which pg-boss
// keeps in its own pgboss schema. The boss starts without supervision, schedules or an instance row,
// so a re-run writes nothing. Given the app's URL, it then grants the app's role its rights.
export async function migrateDatabase(url: string, appUrl?: string) {
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
  if (appUrl) await grantAppRole(url, appUrl);
}

if (import.meta.main) {
  try {
    const env = parseMigrateEnv(process.env);
    await migrateDatabase(env.DATABASE_URL, env.APP_DATABASE_URL);
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
