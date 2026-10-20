# ADR-0002: PostgreSQL instead of SQLite

- Status: accepted (supersedes the earlier SQLite choice for the demo)
- Date: 2026-10-20
- Source: docs/PLAN.md, section 2, "Decision change"

## Context

The earlier analysis chose SQLite for a demo. This build holds real data for 40 or more people working at once, runs a job queue, and may move to institutional hosting later.

## Decision

Use PostgreSQL 18 with Drizzle ORM. Migrations are SQL files reviewed in each pull request. pg-boss runs jobs on the same database.

## Consequences

- Concurrent writes without a single-writer lock.
- Mature point-in-time recovery (WAL-G or pgBackRest) for the backups in Steps 42 and 48.
- One queue and one database to operate: pg-boss needs no extra service.
- Managed PostgreSQL hosting is available in the Kingdom if IT takes the platform over.
- Cost: one more container to run locally and on the server.
