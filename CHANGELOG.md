# Changelog

All notable changes are recorded here. Each entry names the plan step from docs/PLAN.md.

## Unreleased

### Step 02: CI, containers and environment

- GitHub Actions: `check:all`, knip, build and a Playwright smoke test on desktop and iPhone emulation with a PostgreSQL 18 service, traces kept on failure; a job that builds both Docker images, holds the app image under 300 MB and proves both refuse an invalid environment.
- CodeQL (JavaScript/TypeScript and Actions; results kept in the job because the private repository has no code scanning upload), gitleaks and Renovate.
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
