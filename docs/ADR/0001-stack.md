# ADR-0001: Stack

- Status: accepted
- Date: 2026-10-20
- Source: docs/PLAN.md, section 2

## Context

One person builds a platform for 40 or more staff in an Arabic, right-to-left college setting. It runs on a laptop first and later on one server in Saudi Arabia. It needs typed code end to end, premium RTL screens on accessible primitives, background jobs, PDFs with correct Arabic shaping, and storage that can move to SharePoint after approval.

## Decision

One Next.js application and one worker, on PostgreSQL, in Docker. Step 1 installs the latest stable version of each tool and pins the exact versions; Renovate keeps them current.

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 24 LTS, pnpm |
| Framework | Next.js 16 App Router: React 19, Server Components, Server Actions, React Compiler, Turbopack; TypeScript strict |
| UI | Tailwind CSS v4 with tokens generated from the identity repo; shadcn/ui (Radix) owned in the repo; Motion when a step needs more than CSS transitions (none has yet); Lucide; Sonner; cmdk; TanStack Table and Virtual; vaul (BeUI deferred in Step 4, see below) |
| Charts | Recharts (SVG) behind one chart wrapper |
| Forms and validation | Zod 4 at every boundary; react-hook-form; next-safe-action with an auth middleware |
| URL state | nuqs |
| Database | PostgreSQL 18 with Drizzle ORM; SQL migrations reviewed in each PR (ADR-0002) |
| Jobs | pg-boss on the same database, run by a worker process |
| Sign-in | Better Auth: employee number or email with password, remembered devices, TOTP (required for admins), optional passkeys, rate limits; Microsoft Entra ready behind a setting |
| Files | `StorageAdapter`: local disk now, SharePoint through Microsoft Graph after approval; sharp; poppler `pdftoppm` |
| PDF | Playwright Chromium in the worker renders print pages |
| Language | next-intl; Arabic by default (RTL); Latin digits with Arabic month names; Hijri through Intl `islamic-umalqura` where a setting asks |
| Tests | Vitest (unit; integration on real PostgreSQL through Testcontainers); fast-check; Playwright (end to end, phone emulation, axe, visual snapshots); Lighthouse CI; k6 |
| Quality gates | Biome, `tsc`, knip, dependency-cruiser, gitleaks, CodeQL, Renovate (automerge of passing minor and patch updates: ADR-0006) |
| Monitoring | pino with request ids; GlitchTip (replaced by ADR-0005: errors tracked in the platform); `/healthz` and `/readyz`; an uptime check |
| Hosting | Docker Compose on the laptop (Caddy, app, worker, PostgreSQL, encrypted backups); later the same images on one Oracle Cloud Always Free VM in the Jeddah region |

Code is laid out as `app → modules → platform`; dependency-cruiser enforces the direction, modules import each other only through `index.ts`, and `domain/` does no I/O.

## Amendment (Step 4)

The plan also named "selected BeUI motion components (MIT, pinned commit)", to be added only where they beat the plain primitive, for the bottom sheet and the toast stack. BeUI is Saurabh Chauhan's MIT component catalog at https://github.com/starc007/ui-components, pinned at commit `c392b2e712c3d4944bfa4b24c54c8699bbf5f4c7`, the commit the earlier department tracker copied from. Its two candidates are the registry entries `bottom-sheet` and `animated-toast-stack` (also listed at 21st.dev/@starc007), both built on Motion 12; the earlier tracker had to add Radix focus and dismissal handling to the bottom sheet.

Step 4 adds neither: vaul (the bottom sheet) and Sonner (the toast stack) already cover both, and whether a BeUI piece beats them belongs to the open question of springs for sheets and drawers (docs/BACKLOG.md), settled in the UX review of Steps 1 to 10. A piece that wins is copied from that commit with its LICENSE and a provenance note, and Motion is installed with it. Until then Motion is not installed, and Step 4's motion is CSS transitions on the motion tokens.

## Consequences

- One typed codebase for screens, server and jobs; one schema from form to database.
- Interface text, names and limits live in data and message files, enforced by `check:hardcode`.
- More moving parts than a static site: a database container and a worker container to run and back up.
- Step 1 installs only the tooling it needs; each later step adds its own libraries from this table.
