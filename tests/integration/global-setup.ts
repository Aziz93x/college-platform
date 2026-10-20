import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { migrateDatabase } from "../../db/migrate.ts";
import { databaseUrl, TEMPLATE_DATABASE } from "./support/urls.ts";

declare module "vitest" {
  export interface ProvidedContext {
    adminUrl: string;
  }
}

// One PostgreSQL container per run, with a migrated template that each test file clones.
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const adminUrl = container.getConnectionUri();
  try {
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(`create database ${TEMPLATE_DATABASE}`);
    } finally {
      // An open connection would fail with an unhandled error when the container stops.
      await client.end();
    }
    await migrateDatabase(databaseUrl(adminUrl, TEMPLATE_DATABASE));
  } catch (error) {
    // Vitest runs the teardown only after a setup that returned, so a failed setup stops the container itself.
    await container.stop();
    throw error;
  }
  project.provide("adminUrl", adminUrl);
  return async () => {
    await container.stop();
  };
}
