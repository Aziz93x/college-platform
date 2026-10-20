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
| UI | Tailwind CSS v4 with tokens generated from the identity repo; shadcn/ui (Radix) owned in the repo; Motion (from Step 5) with BeUI components (docs/design/beui-map.md); Lucide; Sonner; cmdk; TanStack Table and Virtual; vaul |
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

The plan also named "selected BeUI motion components (MIT, pinned commit)", to be added only where they beat the plain primitive, for the bottom sheet and the toast stack. BeUI (https://beui.dev) is Saurabh Chauhan's MIT motion-component catalog, published from https://github.com/starc007/ui-components; the earlier department tracker copied from commit `c392b2e712c3d4944bfa4b24c54c8699bbf5f4c7`. Its React edition (React, Tailwind and Motion) is the one that fits this web app; the React Native edition is for native apps. Its two candidates are the registry entries `bottom-sheet` and `animated-toast-stack` (also listed at 21st.dev/@starc007), both built on Motion 12; the earlier tracker had to add Radix focus and dismissal handling to the bottom sheet.

Step 4 adds neither: vaul (the bottom sheet) and Sonner (the toast stack) already cover both, and whether a BeUI piece beats them belongs to the open question of springs for sheets and drawers (docs/BACKLOG.md), settled in the UX review of Steps 1 to 10. A piece that wins is copied from that commit with its LICENSE and a provenance note, and Motion is installed with it. Until then Motion is not installed, and Step 4's motion is CSS transitions on the motion tokens.

## Amendment (Step 5)

The owner made motion and the identity the platform's spirit and chose the BeUI components to use. Motion 14.4.0 is installed, and BeUI's bottom sheet, command palette, dock and shared-layout-bg serve the app shell, copied from `starc007/ui-components` at commit `802f83ed09aa3b7fa6c53fbe96ff03621003cd75` with every local change in `src/components/motion/PROVENANCE.md`. The other components the owner chose are mapped to the step that first uses each one (docs/design/beui-map.md) and are adopted there, not before. The elements are Motion's `m` components under `MotionProvider`, which loads the animation features after the first paint, so Motion stays off the critical path. vaul and the Radix sheet remain in the design catalog, and Sonner for toasts; the UX review of Steps 1 to 10 decides whether BeUI's pieces replace them (docs/BACKLOG.md).

## Consequences

- One typed codebase for screens, server and jobs; one schema from form to database.
- Interface text, names and limits live in data and message files, enforced by `check:hardcode`.
- More moving parts than a static site: a database container and a worker container to run and back up.
- Step 1 installs only the tooling it needs; each later step adds its own libraries from this table.
