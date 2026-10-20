import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { inject } from "vitest";
import { createDb } from "../../../src/platform/db/client.ts";
import { databaseUrl, TEMPLATE_DATABASE } from "./urls.ts";

async function admin(statement: string) {
  const client = new Client({ connectionString: inject("adminUrl") });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

// A database of its own for one test file, so files run in parallel without sharing rows.
async function openDatabase(template: string) {
  const name = `t_${randomBytes(6).toString("hex")}`;
  await admin(`create database ${name} template ${template}`);
  const url = databaseUrl(inject("adminUrl"), name);
  const { db, pool } = createDb(url);
  return {
    url,
    db,
    pool,
    drop: async () => {
      await pool.end();
      await admin(`drop database ${name} with (force)`);
    },
  };
}

/** A clone of the migrated template database. */
export function createTestDatabase() {
  return openDatabase(TEMPLATE_DATABASE);
}

/** An empty database, for tests that run the migrations themselves. */
export function createBlankDatabase() {
  return openDatabase("template1");
}

/** A complete, valid environment for a script spawned against `url`. */
export function scriptEnv(
  url: string,
  overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APP_ENV: "local",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: url,
    SMTP_URL: "smtp://localhost:1025",
    SEED_COLLEGE_NAME: "Test College",
    SEED_COLLEGE_SHORT_NAME: "TC",
    ...overrides,
  };
}

/** Runs a script with this Node binary and only the given environment; never rejects. */
export function runScript(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve) => {
      const child = execFile(
        process.execPath,
        [file, ...args],
        { env },
        (_error, stdout, stderr) =>
          resolve({ code: child.exitCode ?? 1, stdout, stderr }),
      );
    },
  );
}
