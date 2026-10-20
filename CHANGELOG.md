# Changelog

All notable changes are recorded here. Each entry names the plan step from docs/PLAN.md.

## Unreleased

### Step 01: repository and guardrails

- Next.js 16 App Router scaffold with TypeScript strict, `src/`, Tailwind CSS v4, Turbopack and the React Compiler; pnpm with exact versions; Node 24 pinned in `.nvmrc` and `engines`.
- Placeholder page rendered right-to-left in Arabic; raw colors moved to `src/styles/tokens.css`.
- Biome, Vitest, Playwright (desktop and iPhone emulation), knip, dependency-cruiser, gitleaks and `.editorconfig`.
- Scripts `check:types`, `check:lint`, `test`, `test:e2e`, `check:hardcode`, `check:boundaries` and `check:all`, plus `check:unused` (knip) and `check:secrets` (gitleaks).
- `check:hardcode` rejects Arabic text in `src/` outside tests, role names compared in code, and hex colors outside `src/styles/tokens.css`.
- `check:boundaries` enforces `app → modules → platform`, module access through `index.ts`, and I/O-free `domain/`.
- `docs/PLAN.md`, ADR-0001 (stack), ADR-0002 (PostgreSQL), `docs/BACKLOG.md`, `CLAUDE.md`.
- Reviewer agents, the `/step`, `/audit`, `/ux-review`, `/lead-review` and `/pm-audit` commands, and the karpathy-guidelines skill under `.claude/`.
