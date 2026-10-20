# Changelog

All notable changes are recorded here. Each entry names the plan step from docs/PLAN.md.

## Unreleased

### Maintenance decisions

- The hosting for staff is part of the approval request: the General Administration chooses between a server inside the college and cloud hosting inside the Kingdom; `docs/ops/hosting-options.md` (Arabic) sets out both.
- ADR-0005: errors are tracked inside the platform (an `error_events` table, the admin's system-health screen and an in-app notification) instead of a self-hosted GlitchTip; docs/PLAN.md section 2 and Steps 42 and 48 follow it.
- ADR-0006: Renovate merges passing minor and patch updates, digest pins and lock file maintenance itself; major and pre-1.0 updates stay manual.

### Audit 1: steps 1-3

- `check:hardcode` catches role-name checks written on one line. On a line that mentions `role`, it flags a role-like string literal (one with no dot or slash, so permission keys such as `"roles.assign"` and paths pass) that is compared, searched for with `.includes`, `.has`, `.startsWith` or `.endsWith`, passed to `hasRole()` or a Drizzle comparison (`eq`, `ne`, `inArray`, `notInArray`, `like`, `ilike`), listed in an assigned array or compared in SQL (`= 'x'`); and an array or `Set` literal searched with `.includes(` or `.has(`. It also flags a `case "x"` in the innermost `switch` on a role, a `SCREAMING_CASE` name with a `ROLE` or `ROLES` part, and an `enum` named after roles. docs/reviews/audit-03.md lists the forms it misses.
- `check:boundaries` makes `domain/` an allowlist: it imports only its own module's `domain/` files, `zod`, `vitest` and types from a module's `index.ts`, so npm I/O packages such as `pg`, `pg-boss`, `drizzle-orm` and `next/headers` fail too, in tests as well.
- `audit_events` is append-only in the database: migration `0001_audit_events_append_only.sql` adds triggers that reject `UPDATE`, `DELETE` and `TRUNCATE`. They stop mistakes, not the table owner, which is the app's own database user.
- CI runs the Playwright smoke test against the standalone production build (`node .next/standalone/server.js`) instead of the dev server.
- ADR-0004 (proposed): the repository stays public, and licensed or non-public brand assets never enter git. `.gitignore` ignores `*.woff`, `*.woff2`, `*.ttf`, `*.otf` and `public/brand/`, a unit test fails when a font or brand file is tracked, and docs/PLAN.md Step 4 carries the rule.
- docs/PLAN.md notes under Step 4 (fonts, color guard gaps, `public/` copy) and Step 11 (the triggers and the retention purge); docs/BACKLOG.md lists minors 1-5 for lead review A.

### Step 03: database, jobs and platform core

- Drizzle ORM on PostgreSQL through `pg`, with a lazy pool so `next build` needs no database. Each module owns its tables: `colleges` (org), `settings` (settings) and `audit_events` (audit), in the first migration `db/migrations/0000_platform_core.sql`.
- `pnpm db:generate` writes SQL to review in the PR, and CI fails when a `schema.ts` changed without it; `pnpm db:migrate` applies the SQL and then installs or upgrades the pg-boss schema, writing no row on a re-run; `pnpm db:seed` creates the one college from `SEED_COLLEGE_NAME` and `SEED_COLLEGE_SHORT_NAME` only when none exists, also when two runs start together.
- `pnpm seed:demo [--seed <0 to 2^32 - 1>]`: a deterministic demo seed (mulberry32, default 42) that is safe to run twice and refuses to run when the new `APP_ENV` (`local`, `staging` or `production`, default `production`) is `production`, before it connects.
- A settings registry in code (key, scope, Zod schema, default) with `locale.timeZone`, which accepts any IANA name or alias that `Intl` can format with, and `getSetting(key, { collegeId })`, which returns the stored value parsed with the key's schema or the registered default. Every setting is college-scoped for now.
- `worker/index.ts` runs pg-boss: a `heartbeat` job scheduled every minute, and a graceful stop on SIGTERM or SIGINT that waits up to 8 s for running jobs, then exits 0, or exits 1 when the stop fails or is still running at 9.5 s, before Docker's SIGKILL. It logs `worker started` only once those signal handlers are installed. A failed start is logged as JSON and exits 1.
- pino JSON logs on stdout; `src/proxy.ts` gives every request a new `x-request-id`, replacing any the client sent, and returns it on the response. Server code logs through `getRequestLogger()`, which adds it to each line, and `onRequestError` in `src/instrumentation.ts` logs every server error Next reports with it. Worker lines carry the queue and job id instead. `/healthz` reports the process alive; `/readyz` checks the database and the queue and answers 503 when either fails.
- `check:boundaries` also checks `worker/` and `db/`, which use a module only through its `index.ts`.
- Integration tests on Testcontainers PostgreSQL inside `pnpm test`, with a database per test file cloned from a migrated template (ADR-0003). CI sets `APP_ENV=local`, migrates the database and loads `pnpm seed:demo` before the end-to-end tests.

### Step 02: CI, containers and environment

- GitHub Actions: `check:all`, knip, build and a Playwright smoke test on desktop and iPhone emulation with a PostgreSQL 18 service, traces kept on failure; a job that builds both Docker images, holds the app image under 300 MB and proves both refuse an invalid environment.
- CodeQL (JavaScript/TypeScript and Actions, results in code scanning), gitleaks and Renovate.
- `docker/Dockerfile` with `app` (Next standalone on Alpine with only the node binary, non-root) and `worker` (Chromium and poppler-utils) targets; every base exists for arm64.
- `docker/compose.dev.yml` (PostgreSQL 18, Mailpit) and `docker/compose.yml` (Caddy, app, worker, PostgreSQL, a daily `pg_dump` backup until Step 42).
- `src/platform/config/env.ts`: one Zod schema for `NODE_ENV`, `APP_URL`, `DATABASE_URL` and `SMTP_URL`; the app (instrumentation) and the worker exit at start and name each invalid variable.
- `pnpm worker` and `pnpm worker:dev`; `.env.example` and `docker/.env.example`.

### Step 01: repository and guardrails

- Next.js 16 App Router scaffold with TypeScript strict, `src/`, Tailwind CSS v4, Turbopack and the React Compiler; pnpm with exact versions; Node 24 pinned in `.nvmrc` and `engines`.
- Placeholder page rendered right-to-left in Arabic; raw colors moved to `src/styles/tokens.css`.
- Biome, Vitest, Playwright (desktop and iPhone emulation), knip, dependency-cruiser, gitleaks and `.editorconfig`.
- Scripts `check:types`, `check:lint`, `test`, `test:e2e`, `check:hardcode`, `check:boundaries` and `check:all`, plus `check:unused` (knip) and `check:secrets` (gitleaks).
- `check:hardcode` rejects Arabic text in `src/` outside tests, role names compared in code, and hex colors outside `src/styles/tokens.css`.
- `check:boundaries` enforces `app → modules → platform`, module access through `index.ts`, and I/O-free `domain/`.
- `docs/PLAN.md`, ADR-0001 (stack), ADR-0002 (PostgreSQL), `docs/BACKLOG.md`, `CLAUDE.md`.
- Reviewer agents, the `/step`, `/audit`, `/ux-review`, `/lead-review` and `/pm-audit` commands, and the karpathy-guidelines skill under `.claude/`.
