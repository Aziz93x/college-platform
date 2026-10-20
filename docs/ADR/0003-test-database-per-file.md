# ADR-0003: A test database per file instead of a schema per file

- Status: accepted
- Date: 2026-10-20
- Source: docs/PLAN.md, Step 3, "a fresh schema per test file"

## Context

Step 3 asks for integration tests on Testcontainers PostgreSQL with a fresh schema per test file, so files can run in parallel without sharing rows. Isolating by schema means running the migrations with a per-file `search_path`. That does not work here, because the migrations name their schemas:

- drizzle-kit writes foreign keys as `REFERENCES "public"."colleges"("id")`, so tables created in a test schema would still point at `public`.
- Drizzle records applied migrations in `drizzle.__drizzle_migrations`, and pg-boss installs into the `pgboss` schema, whatever the `search_path` is.

## Decision

Each test file gets databases of its own. The Vitest global setup starts one PostgreSQL 18 container per run, creates a `template_app` database and migrates it once with the same `migrateDatabase` that `pnpm db:migrate` runs (Drizzle, then pg-boss). A test file then runs `CREATE DATABASE … TEMPLATE template_app` under a random name, once for the file or once per test when each test needs empty tables, and drops each database `WITH (FORCE)` in `afterAll`. A test that runs the migrations itself starts from a blank database cloned from `template1`.

## Consequences

- Tests run against the same schema names and foreign keys as production, with no `search_path` handling in the code under test.
- The migrations run once per run; each file only copies the template.
- Nothing may stay connected to `template_app` after the global setup, or the clone fails.
- A test that stops PostgreSQL, such as the readiness test, starts a container of its own.
- Integration tests need Docker, locally and on the CI runner. They run inside `pnpm test`, so `pnpm check:all` covers them.
