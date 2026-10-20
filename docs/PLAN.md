# College Platform: Build Plan from Scratch

Oct 20, 2026 · @Aziz

This plan builds the platform from an empty repository in 48 steps across 11 sections, with a review built in every 3 steps, every 10 steps, at the end of each section, and once more at the end. Everything runs on your laptop first; the last section takes it online when you decide. Each step is a focused unit of work in Claude Code: a goal, the work, and checks that prove it is done.

## 0. How to run this plan in Claude Code

**Once, before Step 1**

1. Install Node 24, pnpm, Docker Desktop (with the WSL 2 backend on Windows) and the GitHub CLI, and sign in with `gh auth login`.
2. Create an empty folder for the repo. Export this doc as Markdown and save it there as `docs/PLAN.md`.
3. Make sure the `karpathy-guidelines` skill is installed in Claude Code. Step 1 copies it into the repo, so every session and every reviewer reads the same text.

**Running a step.** For Step 1, open Claude Code in that folder and paste this prompt. Step 1 creates a `/step` command, so later you type `/step 7`; the same command resumes a step that spans several sessions.

```
Read docs/PLAN.md. Execute Step 1 only. Stop when every "Done when" check passes,
then summarize what changed and the commands that proved it.
```

**Checkpoints.** Step 1 creates the commands and the reviewer agents (section 5).

| When | Command | Reviewer | Output |
| --- | --- | --- | --- |
| After steps 3, 6, 9 … 48 | `/audit 4-6` | auditor agent with `/karpathy-guidelines` | `docs/reviews/audit-NN.md` and its fixes, in one review pull request |
| After steps 10, 20, 30, 40, 46 | `/ux-review 11-20` | UX and consistency expert | `docs/reviews/ux-NN.md` with screenshots, and its fixes |
| End of each section (A to K) | `/lead-review C` | lead software engineer | `docs/reviews/lead-C.md`; must-fix items fixed; simpler flows proposed |
| After Step 46 | `/pm-audit` | product manager | `docs/reviews/pm-final.md`; the rebuild gate (section 7) |

When several checkpoints land on the same step, run them in this order: audit, then UX review, then lead review. A report is numbered by the last step of its range, for example `audit-06.md` and `ux-20.md`.

**Git rules**

- Step 1 commits to `main`. From Step 2 on, each step has its own branch, `step/NN-<slug>`, and one pull request whose squash title ends with `(step NN)`, for example `feat: sign-in (step 06)`. Merge it when CI is green, before the next step starts.
- Each review works on its own branch named after its report, such as `review/audit-06`, and merges by a pull request titled `audit: steps 4-6`, `ux: steps 11-20`, `lead: section C` or `pm: final`.
- Commit titles follow Conventional Commits.
- After each lead review, tag the section on `main`: `v0.1-A`, `v0.2-B`, and so on. Production deploys only from tags.

**Definition of done for every step**

- `pnpm check:all` passes: types, Biome lint and format, unit and integration tests, `check:hardcode`, `check:boundaries`.
- End-to-end tests for every journey the step touches pass on desktop and on iPhone emulation.
- No domain value is written in code. Names, labels, week counts, roles, axes, limits and texts come from the database, settings or message files.
- Every server action checks a permission and validates its input with Zod. Every change to data writes an audit event.
- Every new screen has its loading, empty, partial, error and no-permission states, and an offline state from Step 39.
- `pnpm seed:demo` gains realistic data for whatever the step adds, so checks and reviews never run on empty screens.
- `CHANGELOG.md` is updated. Any decision that changes this plan gets an ADR in `docs/ADR/`.

Each step heading carries a size: S is about one session, M two or three, L four or more. A step that spans sessions continues on its branch.

## 1. Product brief

**The goal is one loop that the whole college fills together, so each portfolio builds itself during the term instead of being assembled by hand at its end.** The vice-dean sets the term and its general framework. Each head builds the department plan on it. The platform generates every trainer's tasks per section with due weeks. Trainers complete them and attach evidence in place. Heads review a sample and approve each portfolio twice a term. Trainer, department and college portfolios and indicators stay current, and the dean and vice-dean follow execution.

**Who fills what.** Role names, labels and permissions are data; this is the seeded default.

| Role | Fills (owns) | Sees | Home screen |
| --- | --- | --- | --- |
| System admin (مدير النظام) | College profile and branding; departments and their Rayat matching values; accounts and role assignments; Rayat column map; portfolio axes catalog (locked); settings | Audit log, system health, backups | Admin console |
| Dean (العميد) | College vision, mission and leadership message for portfolio front matter; optional endorsement of each term's framework | College and department indicators as totals; approved portfolios | College summary |
| Vice-dean for training (وكيل التدريب) | Terms: Rayat name, start date, number of weeks, holidays, exam weeks, grade deadlines. The general framework: college-wide items under the axes with due weeks and evidence policies. Rayat uploads (SS01, SF01, optional SO01) | Every department down to trainer, section, task and evidence, read only | Term and framework |
| Department head (رئيس القسم) | Department plan on top of the framework; section task templates (tests, homework, grade analysis, e-learning, practices) and their evidence policies; assignments; quick requests; review sample and portfolio approvals; section transfers; account help for own trainers | Department work, indicators, what is missing per trainer and axis | Today (head) |
| Department secretary (أمين القسم) | Meetings, minutes, decisions, recommendations, improvement plans, department documents, draft department portfolio | Department plan and calendar | Department |
| Trainer (المدرب) | Professional profile; tasks and evidence per section; assignment tasks; initiatives, participations and development; portfolio curation and next-term goals | Own tasks, sections, indicators, portfolio | Today (trainer) |
| Quality reviewer (optional) | Comments on portfolios | Approved portfolios | Portfolios |

A term readiness board shows each role what it still owes, before and during the term (Step 22).

**Success metrics.** The platform measures most of these itself (Step 36); the acceptance test (Step 46) and the trial supply the rest. Every threshold is a setting.

| Metric | Target |
| --- | --- |
| Open a task, add camera evidence, mark it done, on a phone | median 60 s or less, 8 taps or fewer |
| Uploads that succeed on the first attempt | 95% or more |
| New trainers who finish a first task without help | 4 of 5, within 10 minutes |
| Sign-ins per completed task | 1 or fewer (remembered device) |
| Head's review time | 120 minutes a week or less |
| SS01 sections matched to their trainer | 100% |
| Trainer portfolio PDF with the 11 axes | one click, 30 s or less |
| Trainers who return in week 2 without a reminder | measured from week 2 |
| The quality unit accepts the platform PDF instead of paper | yes or no |

**In scope:** everything above, for any number of departments; one college now, with every table ready for more.

**Out of scope for now, ready by design:** Microsoft Entra sign-in and SharePoint storage (adapters planned), surveys, Word export, comparisons across terms (after two terms of data).

## 2. Architecture and stack

**One Next.js application and one worker, on PostgreSQL, in Docker: on your laptop first, then on one server in Saudi Arabia when you decide (Section K).** Step 1 installs the latest stable version of each tool and pins the exact versions; Renovate keeps them current.

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 24 LTS, pnpm | current LTS; fast, strict installs |
| Framework | Next.js 16 App Router: React 19, Server Components, Server Actions, React Compiler, Turbopack; TypeScript strict | one typed codebase for screens and server |
| UI | Tailwind CSS v4 with tokens generated from the identity repo; shadcn/ui components (Radix) owned in the repo; Motion when a step needs more than CSS transitions; Lucide; Sonner; cmdk; TanStack Table and Virtual; vaul drawers (BeUI dropped in Step 4, ADR-0001) | full control of a premium RTL interface on accessible primitives |
| Charts | Recharts (SVG) behind one chart wrapper | SVG stays sharp in PDFs and follows the tokens |
| Forms and validation | Zod 4 at every boundary (environment, inputs, settings, JSON payloads); react-hook-form; next-safe-action with an auth middleware | one schema from the form to the database |
| URL state | nuqs | filters and tabs survive reloads and shared links |
| Database | PostgreSQL 18 with Drizzle ORM; SQL migrations reviewed in each PR | concurrent writes, point-in-time recovery, easy for IT to host later |
| Jobs | pg-boss on the same database, run by a worker process | PDFs, imports, thumbnails, digests and metrics with retries |
| Sign-in | Better Auth: employee number or email with password; "remember this device"; TOTP two-factor (required for admins); optional passkeys; rate limits; Microsoft Entra provider ready behind a setting | modern, self-hosted, works with Drizzle |
| Files | `StorageAdapter`: local disk now, SharePoint through Microsoft Graph after approval; sharp; poppler `pdftoppm`; compression and HEIC conversion in the browser | one interface, swappable storage |
| PDF | Playwright Chromium in the worker renders print pages | correct Arabic shaping and real CSS layout |
| Language | next-intl; Arabic by default (RTL), English catalog optional; Latin digits with Arabic month names; Hijri dates through Intl `islamic-umalqura` where a setting asks | no interface text in code |
| Tests | Vitest (unit, and integration on real PostgreSQL through Testcontainers); fast-check; Playwright (end to end, phone emulation, axe, visual snapshots); Lighthouse CI; k6 | each layer tested where it can break |
| Quality gates | Biome, `tsc`, knip, dependency-cruiser, gitleaks, CodeQL, Renovate | fast feedback and enforced module boundaries |
| Monitoring | pino logs with request ids; GlitchTip (self-hosted, Sentry-compatible); `/healthz` and `/readyz`; an uptime check | problems seen before users report them |
| Hosting | Now: Docker Compose on your laptop (Docker Desktop with WSL 2): Caddy with local HTTPS, app, worker with Chromium and poppler, PostgreSQL, and encrypted backups (WAL-G or pgBackRest for the database, restic for files) to a folder you choose. Later (Section K): the same images, also built for Arm, on one Oracle Cloud Always Free VM in the Jeddah region (Ampere A1, 2 OCPUs, 12 GB RAM, up to 200 GB of storage), backups to Oracle Object Storage in the same region, and GitHub Actions building to GHCR and deploying over SSH | small, reproducible, easy to move |

**Decision change, recorded as ADR-0002.** The earlier analysis chose SQLite for a demo. A new build that holds real data for 40 or more people at once, runs a job queue, and may move to institutional hosting later is better served by PostgreSQL: concurrent writes, mature point-in-time recovery, pg-boss on the same database, and managed hosting in the Kingdom later. The cost is one more container.

**Addresses**

- On your laptop: `http://localhost:3000` while developing, and `https://localhost` for the production-like run (Step 41). A phone reaches the laptop through `pnpm local:share`, a temporary HTTPS tunnel used with demo data only (Step 39).
- Later, in Section K: `https://college.azizalmalki.com` opens the login page and sends a signed-in user to their role's home, and `https://staging.college.azizalmalki.com` runs the same build with demo data only.
- Cookies are host-only, Secure and HttpOnly, so nothing is shared with the main site.

**Repository layout**

```
college-platform/
  src/
    app/            routes only: (auth) login, (app) role areas, print/, api/
    modules/        vertical slices: identity, org, settings, terms, framework, rayat,
                    academics, planning, tasks, evidence, review, portfolio,
                    indicators, collaboration, notifications, audit, metrics
      <module>/domain   pure logic, Zod schemas, policies; no I/O
      <module>/server   queries, actions, repositories
      <module>/ui       components of this module
      <module>/index.ts the module's only public entry
    platform/       db, auth, authz, storage, jobs, validation, config, logging
    i18n/           next-intl request config from the college's locale settings (reads modules)
    components/ui/  design-system primitives
    styles/         tokens.css generated from the identity repo, fonts, theme scales
  worker/           job handlers
  db/               migrations, seed/base, seed/demo
  messages/         ar.json (en.json when English is added)
  tests/  e2e/      unit, integration and fixtures (rayat/); Playwright
  docs/             PLAN.md, BACKLOG.md, ADR/, reviews/, ops/, guides/
  .claude/          agents/, commands/, skills/
  docker/           Dockerfile, Caddyfile, compose files
  CLAUDE.md  CHANGELOG.md
```

dependency-cruiser enforces the direction `app → modules → platform`. Modules import each other only through `index.ts`, and `domain/` never imports anything that does I/O.

**Principles**

1. **Capabilities in code, everything else in data.** Code defines what the platform can do: task kinds and their behavior, permission keys, workflows. Data defines the rest: college and department names, roles and their permissions, terms, weeks, calendar, axes, templates, evidence policies, limits, thresholds, texts, branding and Rayat column names. Settings are typed with Zod and seeded with defaults.
2. **One task model.** Every unit of work, from a framework item to a quick request, is a task with a source, an axis, a due date, a snapshot of its evidence policy and a typed payload.
3. **The server decides.** Every action calls `authorize(actor, permission, scope)`. Hiding a button is only cosmetic.
4. **History is append-only.** Reviews, portfolio versions, imports and audit events are never edited.
5. **Phone first for trainers.** The trainer's loop is designed for a phone in a workshop.
6. **Simple first.** No abstraction without a second use, and no feature without someone who needs it. The audits enforce this.

## 3. Domain model and core flows

**Every piece of work is a task generated from something a role filled in, and every portfolio is a view over those tasks.** Every tenant table carries `college_id`; department tables also carry `department_id`.

| Area | Entities | Filled by |
| --- | --- | --- |
| Identity | Better Auth tables (user, session, account, two-factor, passkey); `people` (profile, employee number) | admin, the person |
| Organization | colleges; departments (with Rayat matching values); roles; permissions (keys from code); role\_permissions; memberships (person, role, scope, optional term) | admin |
| Settings | settings (key, scope, value validated by the key's schema, version) | admin, by permission |
| Term | terms (Rayat name, start date, weeks, status); calendar\_events (holiday, exam week, grade deadline, custom) | vice-dean |
| Portfolio catalog | axis\_groups; axes (code, title, order, locked) | admin |
| Framework | frameworks (term, version, status); framework\_items | vice-dean |
| Academics | courses; sections (term, department, course, Rayat reference, trainer, schedule, capacity, enrolled, delivery mode); enrollments (section, trainee number, status); section\_overrides (transfers) | Rayat import, head |
| Rayat | rayat\_imports (kind, term, mapping version, counts, status, diff) | vice-dean |
| Planning | plans (department, term, version, status); plan\_items; task\_templates; assignment\_templates; assignments; quick\_requests | head |
| Work | tasks (source, axis, kind, assignee, section, due date, status, policy snapshot, payload); evidence\_files (storage key, type, size, SHA-256, pages, thumbnail) | trainer |
| Review | review\_samples; reviews (append-only decisions); portfolio\_approvals | head |
| Portfolio | portfolio\_versions (owner: trainer, department or college; snapshot, PDF key, hash, audience) | system |
| Collaboration | meetings; minutes; decisions; recommendations; improvement\_plans; documents | secretary |
| Platform | notifications; notification\_prefs; audit\_events; metric\_events; pg-boss job tables | system |

**Task kinds** are code: each has a Zod payload schema, an editor, a read view and indicator mappings.

- `general`: a plain item with optional evidence.
- `exam_copy`: quiz, midterm, final or practical; question paper and answer key; hidden from others until the exam date.
- `grade_analysis`: counts per grade band, pass rate, average, follow-up actions; never trainee names.
- `homework`: title, week, sample files.
- `e_learning`: checklist (course shell, content, activities) and evidence.
- `training_practice`: methods from a catalog, description, evidence.
- `advising_log`: sessions and notes, without names.
- `meeting_minutes`, `initiative`, `professional_development`, `profile_section`.

**Generation engine.** Publishing a framework or a plan, importing SS01, creating an assignment or sending a quick request creates tasks:

- **Idempotent:** one task per source item, occurrence, assignee and section. Running it twice changes nothing.
- **Re-publish:** add new tasks; move due dates of tasks not started; cancel removed tasks that have no evidence; never touch completed work.
- **Due rules:** week N; weekly; every N weeks; or relative to a calendar event, for example one week after the midterm exam week. Dates skip holidays when the setting says so.
- **Section transfer:** completed work stays with the trainer who did it, marked "until week N"; open tasks move to the new trainer. The transfer holds until the next SS01 import confirms it or flags a conflict.

**Task status:** not started → in progress → submitted → done, plus returned (back to the trainer with a note) and not applicable (with a reason). Overdue is a flag on top of the status, not a status.

**Review model.** Uploading the required evidence completes a task. Each week the platform picks a sample for the head: 10% by default, capped at a weekly number; both are settings. The head approves each trainer's portfolio at mid-term and at term end and sees what changed since the last approval. A head can mark one or two task kinds as "requires approval", for example exam copies. The department portfolio freezes on a date the head sets and lists what is missing.

**Rayat import.** Rayat exports its reports as XLSX. SS01 and SF01 are mandatory; SO01 is optional. Column names come from a versioned mapping in settings, seeded from the real headers in section 9, and only the columns marked there are stored. From SF01 that means term, department, course, section reference, trainee number, registration status and trainee status, never names, mobile numbers or grades. The raw file is discarded after parsing. Each import shows a validation report and a diff against the previous import before it is applied, and it can be rolled back.

**Portfolios.** A portfolio is a computed view of tasks grouped by axis: 11 axes in 3 groups, plus the optional closing group. Each approval freezes an immutable version (snapshot, PDF, hash). Two audiences exist: internal, with evidence pages, and display, a summary for the dean and external visits.

## 4. Design system and UX quality bar

**The interface uses the college identity and nothing else, and it is held to measurable targets checked in CI and in every UX review.**

**Source of truth.** The identity repo `Aziz93x/identity-design` supplies the logos, palette and gradients, DIN Next LT Arabic, and the wave, dot and curve elements. The font is licensed through the owner's employer; confirm the license covers web use and embedding in server-made PDFs. Step 4 pins one commit of the repo and generates the tokens from it.

**Tokens**

- **Color:** brand scale, surfaces, text, borders and status colors. White background as in the identity. Dark tokens are defined, but the dark theme ships later. One functional alert color is a setting, pending your decision on a red exception.
- **Type:** DIN Next LT Arabic, Medium for headings and Regular for body; sizes in rem; body line height 1.7; tabular numbers in tables.
- **Space and shape:** 4 px spacing base, a small radius scale, soft and rare elevation.
- **Motion:** 120 to 200 ms with standard easing, springs for sheets and drawers, and nothing when the system asks for reduced motion.

**Product components** on top of the shadcn/ui primitives: app shell (header with term switcher, search, bell and avatar; sidebar on desktop; bottom tabs on phones), page header, KPI ring and stat tiles, task card, evidence uploader, review card (full screen on phones), week grid, data table, empty states that offer the next action, skeletons shaped like the final layout, and charts with a table toggle.

**What premium means here**

- **Instant feel:** prefetching, optimistic updates and skeletons; never a spinner over content.
- **Calm screens:** generous spacing, one accent per view, motion only where it explains a change, identity art kept for the login page, empty states and the PDF cover.
- **Speed for frequent users:** a command palette (Ctrl or ⌘ K) and keyboard shortcuts in the review inbox.
- **Arabic done right:** logical CSS properties, correct mixed Arabic and Latin text, Arabic-Indic digits accepted in inputs and stored as Latin, and the week number first in dates ("Week 7 · Thursday 23 October").
- **Every state designed:** loading, empty, partial, error, no permission and, from Step 39, offline.

**Measurable bar**

| Check | Target |
| --- | --- |
| Lighthouse, mobile (login, Today, section page) | performance 95 or more, accessibility 100, best practices 95 or more |
| Core Web Vitals | LCP under 2.0 s on 4G, INP under 200 ms, CLS under 0.05 |
| Accessibility | axe: no serious or critical issues; WCAG 2.2 AA; touch targets 44 px; usable at 200% text size |
| JavaScript per route | 170 KB gzipped or less |
| Server time | p95 under 300 ms for reads and under 1 s for writes |

**The login page at `/`.** A split layout on desktop and one column on phones: identity wave art, the platform and college names from settings, employee number or email, password, "remember this device", passkey sign-in when enabled, and a pilot banner whose text is a setting. Showing the college logo before sign-in is also a setting, off until the dean gives written permission.

## 5. Review agents and checkpoint commands

**Each reviewer is a Claude Code agent with a fresh context, so no one grades their own work. Reviewers only report; the main session applies the fixes on the review's branch.** Step 1 creates these files exactly as written here.

**`.claude/agents/auditor.md`**

```markdown
---
name: auditor
description: Audits a range of plan steps against the karpathy guidelines and the plan's rules. Use after every 3 steps.
tools: Read, Grep, Glob, Bash, Write
---
You audit the plan steps given as a range, for example "4-6". You did not write this code; judge it as an outsider.
First read .claude/skills/karpathy-guidelines/SKILL.md. Then read docs/PLAN.md (the steps and their "Done when")
and CLAUDE.md. Find the range's commits, whose titles end with "(step NN)" (git log --oneline --grep "(step "),
and read their diffs.

Judge every change against the four karpathy guidelines:
1. Think before coding: were assumptions stated and ambiguities resolved, or silently guessed?
2. Simplicity first: code beyond what the step asked; abstractions with one use; error handling for
   impossible cases; 200 lines that could be 50. Configuration the plan lists is required;
   configuration beyond it is not.
3. Surgical changes: every changed line traces to the step; no unrelated refactors or formatting churn;
   orphans the change created are removed.
4. Goal-driven execution: every "Done when" item is proven by a command you ran; tests fail without the change.

Then the plan's rules:
- Run pnpm check:all and the step's end-to-end tests; quote the result lines.
- No hardcoded domain values (pnpm check:hardcode); permissions checked by key, never by role name.
- authorize() and Zod on every server action; an audit event on every change to data.
- Loading, empty, partial, error and no-permission states on every new screen.
- pnpm seed:demo holds realistic data for what the steps added.

Write docs/reviews/audit-NN.md, where NN is the last step of the range: findings by severity (blocker, major,
minor), each with file:line or command output and its fix; then at most 3 enhancements with benefit and cost.
Write only under docs/reviews/; never edit code.
```

**`.claude/agents/ux-expert.md`**

```markdown
---
name: ux-expert
description: Reviews consistency, premium finish and usability of the screens built in a range of steps. Use after every 10 steps.
tools: Read, Grep, Glob, Bash, Write
---
You are a senior product designer for Arabic right-to-left interfaces.
1. On a fresh database loaded with pnpm seed:demo, run pnpm e2e:screens to capture every route touched in
   the range, per role, at 390, 768 and 1440 px, into docs/reviews/ux-NN/. When the range ends at Step 46,
   capture every route for every role.
2. Check each screen against docs/PLAN.md section 4:
   - tokens only: no ad-hoc colors, sizes, radii or shadows; spacing on the 4 px scale;
   - identity rules: logo use, fonts, wave and dot elements used sparingly;
   - the same pattern for the same job everywhere: page header, table, form, empty state, dialog;
   - every state present: loading, empty, partial, error, no permission, and offline from Step 39;
   - right-to-left details: mirrored icons where direction matters, mixed text, numbers, alignment;
   - phone: thumb reach, 44 px targets, sheets instead of dialogs, 200% text size;
   - motion: purposeful, 200 ms or less, reduced motion respected;
   - copy: short, specific, one term per concept as in messages/ar.json.
3. Score each screen 1 to 5 for clarity, consistency and finish. Anything under 4 needs a fix.
Write docs/reviews/ux-NN.md, where NN is the last step of the range: a table of screens and scores, then fixes
in priority order with the expected result. Write only under docs/reviews/; never edit code.
```

**`.claude/agents/lead-engineer.md`**

```markdown
---
name: lead-engineer
description: Verifies that a finished plan section works as a system and finds simpler flows. Use at the end of each section.
tools: Read, Grep, Glob, Bash, Write
---
You are the lead software engineer. A section of docs/PLAN.md is finished; verify it as a system.
1. Run pnpm check:all and the full end-to-end suite on pnpm seed:demo data; report failures first.
2. Integration: trace one record from where a role fills it to every screen, report and PDF that uses it.
3. Architecture: pnpm check:boundaries; modules used only through index.ts; no duplicated logic;
   migrations reviewed and reversible.
4. Data and speed: an index for every query the section added (EXPLAIN the slow ones); no N+1 queries;
   server p95 within the budget in section 4.
5. Security: the permission matrix test covers every new action; inputs validated; files authorized.
6. Better flow: for each journey in the section, count screens, taps and fields. Propose a simpler path
   that keeps every outcome the plan requires, with its cost.
Write docs/reviews/lead-<section>.md: must-fix items first, then proposals ranked by benefit over cost.
Propose an ADR when a proposal changes the plan. Write only under docs/reviews/; never edit code.
```

**`.claude/agents/product-manager.md`**

```markdown
---
name: product-manager
description: Audits the finished product against its goal, roles and success metrics, and decides the rebuild gate. Use once after Step 46.
tools: Read, Grep, Glob, Bash, Write
---
You are the product manager. Judge outcomes, not code.
1. Read docs/PLAN.md sections 1 and 7, every report in docs/reviews/, and the acceptance-test results.
2. For each role in "Who fills what", run its journey with demo data (Playwright) on the production-like
   stack from Step 41, or on staging once Section K is done, and confirm every responsibility works end to end.
3. For each success metric, report the measured value from the Pilot indicators page and the acceptance
   test against its target; mark the ones only the trial can measure.
4. Check the original requirements: nothing hardcoded; evidence attached where the work is; the head
   controls plan items and evidence policies; integrated portfolios for trainer, department and college;
   dean and vice-dean visibility; every role fills its part of the loop.
5. List gaps and improvements ranked by impact on the goal and by cost.
6. Decide the rebuild gate in section 7 and justify it with numbers.
Write docs/reviews/pm-final.md. Write only under docs/reviews/; never edit code.
```

**`.claude/agents/qa-tester.md`**

```markdown
---
name: qa-tester
description: Loads the demo data, runs every role journey and explores each role for defects. Use in Step 44.
tools: Read, Grep, Glob, Bash, Write
---
1. Run pnpm seed:demo --seed 42 --week 9 on a clean database.
2. Run pnpm test:e2e for all journeys on desktop and phone.
3. Explore each role for 20 minutes through throwaway Playwright specs in tests/explore/ (git-ignored):
   wrong inputs, double clicks, the back button, a slow network, large and odd files.
4. Record each defect in docs/reviews/qa-44.md with steps, expected, actual, a screenshot saved in
   docs/reviews/qa-44/, and a priority from P0 to P3.
Write only under docs/reviews/ and tests/explore/; never edit code.
```

**Commands in `.claude/commands/`**

`step.md`

```markdown
---
description: Execute or resume one step of docs/PLAN.md
argument-hint: <step number>
---
Read CLAUDE.md and docs/PLAN.md. Work on Step $ARGUMENTS only. NN below is the step number in two digits.
1. If a branch step/NN-* exists, check it out and continue from the unchecked items in its PR checklist.
   Otherwise create step/NN-<slug> from an up-to-date main.
2. Before coding, state your assumptions and a short plan as "step -> verify" lines.
   If anything is unclear or conflicts with the code, stop and ask.
3. Items marked "You:" belong to the owner: stop there, hand over a short checklist, and continue when told.
4. Work until every "Done when" check passes and pnpm check:all is green; extend pnpm seed:demo.
5. Open or update the PR with the checklist; its title ends with (step NN). Summarize what changed and the
   commands that proved it. When CI is green, squash-merge it.
```

`audit.md`

```markdown
---
description: Audit plan steps with the auditor agent and the karpathy guidelines
argument-hint: <from-to>, for example 4-6
---
1. Load the karpathy-guidelines skill.
2. From an up-to-date main, create branch review/audit-NN (NN: the last step of the range, two digits).
3. Use the auditor agent to audit steps $ARGUMENTS of docs/PLAN.md.
4. Fix every blocker and major finding.
5. Apply enhancements that stay within the plan and take under an hour; add larger ones to
   docs/BACKLOG.md for the next lead review.
6. Re-run pnpm check:all and the affected end-to-end tests; append the results to the report.
7. Open a PR titled "audit: steps $ARGUMENTS" with the report and the fixes; squash-merge it when CI is green.
```

`ux-review.md`

```markdown
---
description: UX and consistency review of the screens built in a range of steps
argument-hint: <from-to>, for example 11-20
---
1. From an up-to-date main, create branch review/ux-NN (NN: the last step of the range).
2. Use the ux-expert agent to review steps $ARGUMENTS.
3. Fix every screen scored under 4 and every consistency break.
4. Re-capture the screenshots; update visual baselines only for intended changes.
5. Open a PR titled "ux: steps $ARGUMENTS" with the report and the fixes; squash-merge it when CI is green.
```

`lead-review.md`

```markdown
---
description: Lead engineer review at the end of a plan section
argument-hint: <section letter>
---
1. From an up-to-date main, create branch review/lead-$ARGUMENTS.
2. Use the lead-engineer agent to review section $ARGUMENTS.
3. Fix every must-fix item.
4. For each flow proposal I accept, write an ADR and add a note to the affected step in docs/PLAN.md
   before implementing it.
5. Open a PR titled "lead: section $ARGUMENTS"; squash-merge it when CI is green, then tag the section
   release on main.
```

`pm-audit.md`

```markdown
---
description: Final product-manager audit and rebuild gate
---
1. From an up-to-date main, create branch review/pm-final.
2. Use the product-manager agent.
3. Open a PR titled "pm: final" with docs/reviews/pm-final.md, then act on its verdict as section 7 of
   docs/PLAN.md describes.
```

## 6. Build steps

**48 steps in 11 sections, each step with its goal, its work and the checks that prove it is done. Checkpoint lines show where each review runs. Sections A to J run on your laptop; Section K takes the platform online when you decide.**

### Section A. Foundation (steps 1 to 6)

#### Step 1. Repository and guardrails (M)

**Goal:** an empty but strict repository that enforces this plan from the first commit.

**Do**

- Create the private repo `Aziz93x/college-platform` with `gh`. Scaffold with create-next-app: TypeScript strict, App Router, `src/`, Tailwind, Turbopack; turn on the React Compiler. Use pnpm; pin Node 24 in `.nvmrc` and `engines`.
- Add Biome, Vitest, Playwright, knip, dependency-cruiser, gitleaks and `.editorconfig`.
- Scripts: `check:types`, `check:lint`, `test`, `test:e2e`, `check:hardcode`, `check:boundaries`, `check:all`.
- `check:hardcode` fails on Arabic letters in `src/` (outside tests), on role names compared in code, and on hex colors outside `src/styles/tokens.css`.
- Commit `docs/PLAN.md` as you saved it, and write `docs/ADR/0001-stack.md` and `docs/ADR/0002-postgres.md` from section 2. Create `CHANGELOG.md`, and `docs/BACKLOG.md` holding the backlog from section 8.
- Create the five agents and five commands from section 5, copy the installed `karpathy-guidelines` skill to `.claude/skills/karpathy-guidelines/SKILL.md`, and write this `CLAUDE.md`:

```markdown
# College Platform
Arabic-first platform where each role fills its part of one loop: term and framework (vice-dean)
-> department plan (head) -> tasks per trainer and section -> evidence -> review -> portfolios and indicators.

## Rules
- Work on one step of docs/PLAN.md at a time; never start the next step. /step resumes a step in progress.
- Before coding, state assumptions and a "step -> verify" plan. If anything is unclear, ask.
- Items marked "You:" in a step belong to the owner: stop and hand over a checklist.
- Capabilities in code, everything else in data: no names, labels, week counts, role names, limits,
  colors or Arabic text in src/. Use settings, the database or messages/*.json.
- Every server action: next-safe-action, a Zod input schema, authorize(actor, permission, scope),
  and an audit event. Check permissions by key, never by role name.
- Modules import each other only through index.ts; domain/ has no I/O.
- Every behavior change comes with a test that fails without it.
- Write the minimum code that solves the step; no speculative abstractions.
- Extend pnpm seed:demo with realistic data for everything you add.
- Every screen: loading, empty, partial, error and no-permission states (offline from Step 39);
  right-to-left; phone first.

## Commands
pnpm dev | pnpm check:all | pnpm test | pnpm test:e2e | pnpm e2e:screens
pnpm db:generate | pnpm db:migrate | pnpm db:seed | pnpm seed:demo | pnpm admin:create | pnpm identity:sync
pnpm local:up | pnpm local:down | pnpm local:share
```

**Done when**

- `pnpm check:all` passes on the placeholder page.
- A file in `src/` containing an Arabic word makes `check:hardcode` fail (the guard is proven).
- `/step`, `/audit`, `/ux-review`, `/lead-review` and `/pm-audit` appear in Claude Code, and the skill file is in `.claude/skills/`.

#### Step 2. CI, containers and environment (M)

**Goal:** every pull request is checked automatically, and the app runs the same way on a laptop and on the server.

**Do**

- GitHub Actions: install with cache, `check:all`, build, a Playwright smoke test with a PostgreSQL service; keep traces on failure. Add CodeQL, gitleaks and Renovate. Protect `main` with required checks and no required reviewers, since one person builds it.
- A Dockerfile with two targets: `app` (Next standalone output, non-root user) and `worker` (adds Chromium and poppler-utils). Section K adds an arm64 build for the server, so every base image and tool must also exist for arm64.
- `docker/compose.dev.yml` (PostgreSQL 18, Mailpit) and `docker/compose.yml` (Caddy, app, worker, PostgreSQL, backup), which runs the same way on your laptop (Step 41) and on the server (Section K).
- `src/platform/config/env.ts`: one Zod schema for every environment variable; the app and the worker refuse to start on invalid values and say which one.

**Done when**

- A pull request shows every check green, and a deliberate type error fails CI.
- `docker compose -f docker/compose.dev.yml up -d` then `pnpm dev` serves the placeholder page.
- The app image is under 300 MB and the worker image builds.

#### Step 3. Database, jobs and platform core (M)

**Goal:** migrations, seeds, a job queue and logging that every module will use.

**Do**

- Drizzle on PostgreSQL. Migration flow: `db:generate`, review the SQL in the PR, then `db:migrate`. First tables: colleges, settings, audit\_events.
- `db/seed/base.ts`, idempotent: one college whose placeholder values come from the environment.
- A settings registry in code (key, scope, Zod schema, default) and `getSetting(key, scope)`, which reads the settings table and falls back to the registered default. Step 7 adds the screen and the audit trail.
- `pnpm seed:demo`: a deterministic demo seed (`--seed`), safe to run twice, that refuses to run against production. Every later step extends it.
- pg-boss setup and `worker/index.ts` with a heartbeat job and graceful shutdown.
- pino logger with a request id on every log line; `/healthz` (process alive) and `/readyz` (database and queue reachable).
- Integration test harness on Testcontainers PostgreSQL, a fresh schema per test file.

**Done when**

- Running `pnpm db:migrate && pnpm db:seed` twice leaves the database unchanged (test).
- `getSetting` returns the registered default until a value is stored, then the stored value (test), and `pnpm seed:demo` runs twice without duplicates.
- The worker logs a heartbeat every minute, and `/readyz` fails while PostgreSQL is stopped.
- Integration tests run in CI.

> **Checkpoint: Audit 1.** Run `/audit 1-3`.

#### Step 4. Identity tokens and design-system base (L)

**Goal:** the identity becomes code: tokens, fonts and primitives, right to left.

**Do**

- `pnpm identity:sync` pulls a pinned commit of `Aziz93x/identity-design` and writes `src/styles/tokens.css` (Tailwind v4 `@theme`), `public/brand/` (logos and elements) and the font files, loaded with `next/font/local`, `font-display: swap` and a metric-matched fallback.
- The root layout takes language and direction from settings (`<html lang="ar" dir="rtl">`); wrap Radix in a DirectionProvider.
- next-intl with `messages/ar.json`, and a shared Zod preprocessor that turns Arabic-Indic digits into Latin ones, used by every input from Step 6 on.
- Add shadcn/ui primitives restyled with the tokens: button, input, textarea, label, form, select, checkbox, radio, switch, dialog, sheet, drawer, dropdown, popover, tooltip, tabs, table, badge, avatar, skeleton, progress, separator, scroll area, command, toast (Sonner), calendar. Add BeUI motion pieces only where they beat the plain primitive (bottom sheet, toast stack).
- A `/design` page, for development and admins only, showing every token and component in every state.
- `pnpm e2e:screens`: captures given routes per role at 390, 768 and 1440 px into a folder (the UX reviews use it).

**Done when**

- `/design` shows every primitive; Playwright visual baselines exist at the three widths.
- axe reports no serious issues on `/design`, and `check:hardcode` finds no hex color outside the tokens.
- Arabic text shapes correctly in the identity font, with no layout shift when the font loads (CLS under 0.05).

**Notes from Audit 1**

- Fonts and non-public brand assets are fetched by `identity:sync` and gitignored, never committed (ADR-0004). `next/font/local` reads the font files at build time, so CI and the Docker build fetch them before `pnpm build`.
- Close the color guard gaps: dark tokens without the `prefers-color-scheme` media query, `rgb()`, `hsl()` and `oklch()` in the color rule, and `--color-*: initial` in `@theme`.
- The first `public/` files need copying next to the standalone server: `cp -r public .next/standalone/public` in `.github/workflows/ci.yml`, and `COPY --from=build --chown=node:node /repo/public ./public` in the `app` stage of `docker/Dockerfile`.

#### Step 5. App shell and navigation as data (M)

**Goal:** one shell for every role, with navigation driven by permissions.

**Do**

- A navigation registry: each item has an id, a message key, an icon, a route and the permission it needs; the order per role comes from settings.
- Desktop: sidebar plus a header with term switcher, search, bell and avatar menu. Phone: bottom tabs (five at most) plus a sheet for the rest.
- Page header and breadcrumbs; error, not-found and no-permission pages; skeleton layouts; route groups `(auth)`, `(app)` and `print`.
- A command palette (Ctrl or ⌘ K) that lists the pages the user may open.

**Done when**

- A unit test renders the navigation for fixture permission sets and matches the expected items (roles arrive in Step 9).
- Lighthouse on the shell, mobile: performance 95 or more, accessibility 100.

**Notes from Step 4**

- The root layout reads the locale settings from the database on every request (ADR-0007, proposed), so an error there reaches no segment `error.tsx`. `src/app/global-error.tsx` must render without the database: its own `<html lang dir>` from the registered default language and its messages imported statically.
- Under Cache Components, a `notFound()`, `forbidden()` or `unauthorized()` thrown after a loading boundary has streamed keeps a 200 status. Where the status matters, decide it in `src/proxy.ts` first, as `/design` does.

#### Step 6. Sign-in and the login page (L)

**Goal:** secure sign-in at `/`, on the premium login page.

**Do**

- Better Auth with the Drizzle adapter: sign-in by employee number or email; password policy, lockout and idle timeouts from settings; "remember this device" (30 days by default) with re-authentication before sensitive actions; TOTP two-factor required for admins; passkeys behind a setting; password change at first sign-in.
- Authorization core: the permission keys used so far, a seeded system-admin role, and `authorize(actor, permission, scope)` in the next-safe-action middleware; Step 9 adds the other roles, the grid and the matrix test. `pnpm admin:create` creates an admin from the terminal.
- Password reset without email by an admin, always audited. Heads get scoped resets in Step 10.
- Host-only Secure HttpOnly cookies with SameSite=Lax; origin checks on every change; security headers and a nonce-based Content Security Policy set in `proxy.ts`.
- The login page from section 4, with every word from messages and settings.

**Done when**

- End-to-end tests pass for sign-in, sign-out, lockout after wrong passwords, a remembered device, admin two-factor and the forced password change.
- Every response carries the security headers (test); the login page meets the section 4 targets on phone emulation (LCP under 2.0 s); and `pnpm admin:create` makes an admin who can sign in.

**Notes from Step 4**

- `/design` is gated by `APP_ENV` (local only) until authorization exists; add the admin permission check here, in the page, and keep the proxy's 404 for a refused request.
- The identity gradient (`references/palette-source.md` in the identity repo) is not a token yet; the login page's identity art adds it to the token mapping in `scripts/identity/identity.lock.json`.
- The four college logos are fetched into `public/brand/`, so `/brand/logo-*.svg` is reachable without sign-in although no page shows a logo. Keep it that way, or move the logos out of `public/`, according to the dean's answer on the logo before sign-in (section 8).

> **Checkpoint: Audit 2.** Run `/audit 4-6`.
>
> **Checkpoint: Lead review A.** Run `/lead-review A`, then tag `v0.1-A`.

### Section B. Organization, roles and settings (steps 7 to 12)

#### Step 7. Settings screen, defaults and audit (M)

**Goal:** every value that may change lives in settings, typed and audited.

**Do**

- The registry from Step 3 gains, for each setting, a description message key and the permission needed to edit it.
- `setSetting` validates against the key's schema and writes an audit event; `getSetting` gets a per-request cache, invalidated on change.
- An admin screen generated from the schemas (text, number, yes/no, choice, list, token reference), with search and "reset to default".
- Seeded defaults: platform name, college name, language and direction, time zone (Asia/Riyadh), first day of the week (Sunday), digits (Latin), Hijri display, password policy, lockout threshold and duration, session and idle timeouts, remembered-device days, file size limit and accepted types, review sample rate and weekly cap, reminder rules, pilot banner text, logo on the login page (off).

**Done when**

- A value changed on the screen is what `getSetting` returns on the next request (integration test).
- Every setting has a description and an audit trail, and invalid values are rejected by the schema.

**Notes from Step 4**

- There is no direction setting: the direction follows from `locale.language` through `Intl.Locale#getTextInfo()`, so "language and direction" above seeds the language only.
- The locale settings are read per request today (ADR-0007, proposed). If the owner chooses the cached alternative, `setSetting` invalidates the locale cache tag.
- The calendar takes its first day of the week from react-day-picker's `ar` locale, which starts on Saturday; pass the seeded first day of the week (Sunday) to it as `weekStartsOn`.

#### Step 8. Colleges and departments (S)

**Goal:** the organization is data.

**Do:** department management for admins: name, short name, Rayat matching values and active flag. From now on every tenant table carries `college_id`. No department name appears in code or in the base seed; the demo seed adds the three demo departments.

**Done when:** an admin creates three departments on the screen, their matching values are stored, and audit events exist.

#### Step 9. Roles, permissions and memberships (L)

**Goal:** who may do what is data, enforced by one function.

**Do**

- Permission keys in code, for example `term.manage`, `framework.publish`, `rayat.import`, `plan.edit`, `plan.publish`, `assignment.manage`, `task.complete`, `review.decide`, `portfolio.approve`, `indicators.view.college`.
- Roles as data: each role row stores its key and its labels. Step 6 seeded the system admin; seed the dean, vice-dean, head, secretary, trainer and quality reviewer with their grid. Admins edit the grid and add roles; the last admin cannot remove their own access.
- Memberships: person, role, scope (college or department), optional term.
- Scopes for `authorize()` (college, department, own records) and scoped query helpers, used by every server action through the next-safe-action middleware.
- A generated permission-matrix test: every action, for every role, inside and outside its scope.

**Done when**

- The matrix test passes, and it fails when one check is removed from one action.
- Changing a role's permissions on the grid changes access at once (end-to-end test).

> **Checkpoint: Audit 3.** Run `/audit 7-9`.

#### Step 10. People and accounts (M)

**Goal:** accounts for every role, imported in bulk and managed safely.

**Do**

- People management, and import from CSV or XLSX (employee number, name, email, department, role) with a preview, row errors and a dry run.
- Account states: invited, active, locked, disabled. Heads help their own trainers by permission: reset a password, link an employee number.
- A basic profile page; the trainer's professional profile arrives in Step 28.

**Done when:** 40 people import from a sample file with a preview; a head can reset passwords only inside their department (test); every action is audited; and `seed:demo` adds the demo people listed in Step 43.

> **Checkpoint: UX review 1.** Run `/ux-review 1-10` (login, shell, design page, settings, departments, roles, people).

#### Step 11. Audit log and history (S)

**Goal:** every change can be traced.

**Do:** append-only `audit_events` (actor, action, entity, diff, IP, user agent, time); an admin viewer with filters, search and export; a history panel reused on entity pages; retention as a setting.

**Done when:** a test lists every server action and asserts each one writes an event, and the viewer pages through 100,000 events in under 300 ms.

**Note from Audit 1:** `db/migrations/0001_audit_events_append_only.sql` rejects every `UPDATE`, `DELETE` and `TRUNCATE` on `audit_events`, so the retention purge needs its own allowed path past those triggers, and so does any backfill in a later migration. The triggers stop mistakes, not the table owner, which is the app's own database user.

#### Step 12. Notifications foundation (M)

**Goal:** people hear about what matters and nothing else.

**Do**

- Notifications table, a bell with an unread count, and a notification center.
- Preferences per kind and channel; message templates as data with variables.
- A weekly digest job, Sunday 7:00 by default; an SMTP email adapter, off by default; web push (VAPID) behind a setting, for the installed app.

**Done when:** the digest job produces the expected in-app digest for a fixture (snapshot test), and switching email on or off is a setting, not a code change.

> **Checkpoint: Audit 4.** Run `/audit 10-12`.
>
> **Checkpoint: Lead review B.** Run `/lead-review B`, then tag `v0.2-B`.

### Section C. Term, framework and Rayat: the vice-dean's part (steps 13 to 17)

#### Step 13. Terms and calendar (M)

**Goal:** the vice-dean defines the term, and every date in the platform derives from it.

**Do**

- Term: name as in Rayat, start date, number of weeks, status (draft, active, closed); one active term per college.
- Calendar events: holidays (date ranges), exam weeks, grade submission deadlines, custom events.
- Week utilities: week number to dates and back, skipping holidays when the setting says so; Hijri display.
- An "open next term" wizard that creates the next term from the current one's calendar; Steps 15, 18 and 19 each add their part to the copy (framework, templates, plans) as drafts.

**Done when**

- Unit tests cover week calculations across Ramadan and Eid breaks.
- The vice-dean creates an 18-week term with holidays on the screen, and the wizard creates the next term from it (integration test).

#### Step 14. Portfolio axes catalog (S)

**Goal:** the administration's axes are data, protected from accidental change.

**Do:** axis groups and axes (code, title, description, order, locked). Seed the 11 axes in 3 groups and the optional closing group (conclusion, aspirations). Only admins change a locked axis, and each change is audited.

**Done when:** the seed loads the axes, and a vice-dean cannot rename a locked axis (test).

#### Step 15. The general framework (M)

**Goal:** college-wide items that every department plan inherits.

**Do**

- A framework per term. Each item has a title, an axis, a task kind, who it applies to (all trainers, each section, heads, secretaries or a role), a due rule, an evidence policy (required or optional, accepted types, maximum files, requires approval) and notes.
- Draft, publish as a new version, and an impact preview: "creates N tasks across D departments".
- Optional dean endorsement before publishing, controlled by a setting.
- A read-only framework view for heads and trainers.

**Done when:** the impact preview comes from one shared, unit-tested counting function that the Step 20 engine reuses; publishing creates an immutable version; and the Step 13 wizard copies the framework as a draft.

> **Checkpoint: Audit 5.** Run `/audit 13-15`.

#### Step 16. Rayat import: SS01, SF01 and SO01 (L)

**Goal:** sections, trainers and enrollments come from Rayat, keeping only the data the platform needs.

**Do**

- Upload by the vice-dean, or anyone holding `rayat.import`. Parse XLSX, Rayat's original format, and accept CSV as a fallback; stream large files.
- Column mapping per report kind from settings, versioned, and seeded from the headers in section 9. Header-only fixtures in `tests/fixtures/rayat/` use the same headers.
- Validation: required columns present, one term per file, departments matched by their matching values, numbers valid (in SS01, capacity equals enrolled plus remaining), duplicates found, and the meeting rows of one SS01 section merged by its section reference. The report is in plain Arabic.
- Keep only the columns marked in section 9. SF01's trainee name, mobile number and grade are dropped while parsing and never stored or logged. Discard the raw file after parsing.
- Show a diff against the previous import, apply it in one transaction, keep versions, allow rollback.

**Done when**

- Synthetic SS01, SF01 and SO01 files in XLSX, built on the headers in section 9, import end to end, and the demo seed loads them.
- A test asserts that no name, mobile or grade column exists in the schema or the data.
- Rollback restores the previous version.

#### Step 17. Courses, sections, enrollments and transfers (M)

**Goal:** every section has its trainer, schedule and numbers.

**Do:** courses (code, name, hours); sections linked to trainers by employee number, with a report of unmatched trainers; enrollments; section transfers by heads (reason, effective week) following the rules in section 3; conflicts with a newer SS01 flagged for review.

**Done when:** unit tests prove the transfer rules (completed work stays, open work moves), and the unmatched report lists trainers missing from people.

> **Checkpoint: Lead review C.** Run `/lead-review C`, then tag `v0.3-C`.

### Section D. Department planning: the head's part (steps 18 to 22)

#### Step 18. Task kinds and section templates (L)

**Goal:** every kind of work the college asks for is a kind with a schema, an editor and a view.

**Do**

- The kinds registry from section 3, each kind with a Zod payload, an editor, a read view and indicator mappings.
- Catalogs as data: training methods, development types, exam types, grade bands.
- Section templates at college level (from the framework) and at department level (by the head). Examples: midterm and final exam copies, quizzes, three homework samples, a grade analysis after each exam, e-learning setup, training practices. Due rules can follow the calendar, such as one week after the midterm exam week.

**Done when:** payload validation is tested for every kind, a head creates section templates on the screen, every template points to an axis, and the Step 13 wizard copies templates as drafts.

> **Checkpoint: Audit 6.** Run `/audit 16-18`.

#### Step 19. Department plan editor (L)

**Goal:** a head builds the term plan in under 30 minutes.

**Do**

- A plan per department and term, built on the framework. Inherited items show as locked. Department items carry a title, axis, kind, assignee rule (a person, a role, all trainers, each section's trainer, the secretary), due rule, evidence policy and review requirement.
- A week grid editor (items by weeks) with drag, multi-select and keyboard control, and inline validation.
- Drafts; publish with an impact preview and a review-load preview ("about N reviews a week"); versions; copy from the previous term.

**Done when:** a scripted usability run builds a 50-item plan in under 30 minutes, publish previews use the shared counting function, versions cannot be edited, and the Step 13 wizard copies the plan as a draft.

#### Step 20. Generation engine (L)

**Goal:** tasks appear for the right person, section and week, every time.

**Do:** build the engine described in section 3: idempotent keys, the re-publish rules, section transfers and recurring due rules. A daily job handles recurring items. Generation runs in the worker and reports progress.

**Done when:** property-based tests (fast-check) prove that generation is idempotent and never changes completed work; for every demo framework and plan, the published preview equals the tasks generated; and generation for the full demo data set takes under 10 s.

> **Checkpoint: UX review 2.** Run `/ux-review 11-20` (audit log, notifications, term and framework, Rayat import, sections, templates, plan editor).

#### Step 21. Assignments (M)

**Goal:** heads give trainers extra responsibilities, each with its own tasks.

**Do**

- Assignment templates as data. Seed the six from today's app: department secretary, specialty supervisor, workshops and labs supervisor, schedule coordinator, cooperative training coordinator, safety supervisor. Heads add more, such as inventory officer.
- Assign a template to one or more trainers for a term or a date range; its tasks are generated under the axis set on the template (seeded: axis 9), and Step 24's work list shows them.
- A template may grant a role. By default only the secretary template does, granting the secretary's permissions in that department.

**Done when:** assigning the secretary template grants the secretary permissions, revoking it removes them, and the template's tasks exist for the assignee (tests).

> **Checkpoint: Audit 7.** Run `/audit 19-21`.

#### Step 22. Quick requests and the term readiness board (M)

**Goal:** urgent requests without opening the plan editor, and one board that shows who still owes what.

**Do**

- Quick request: title, due date, targets (everyone, a role, chosen people), evidence yes or no. Tasks are created at once and recorded as ad-hoc plan items.
- Term readiness board: each role's open responsibilities, with owner and link. It covers the term and framework published, people imported, Rayat imported and matched, and each department plan published; Step 28 adds trainer profiles. The vice-dean, dean and heads see it.

**Done when:** a head sends a quick request to 12 trainers in under 30 seconds, and the board turns fully green for the demo term once every input exists (integration test).

> **Checkpoint: Lead review D.** Run `/lead-review D`, then tag `v0.4-D`.

### Section E. The trainer's work loop (steps 23 to 28)

#### Step 23. Today: each role's home (L)

**Goal:** everyone opens the platform and knows what to do now.

**Do**

- Trainer: returned work first, then this week's tasks by due date, the overdue group, and a growing card "portfolio: 12 of 40". On first use: "your tasks appear when your plan is published" plus one first task, "complete your profile".
- Head: overdue work per trainer, "nothing uploaded this week" with a one-tap reminder, and a quick-request button; Step 29 adds the week's review sample.
- Vice-dean and dean: term readiness and framework progress; indicators join them in Section G.

**Done when:** Today's server time stays under 300 ms at p95 on demo data (section 4), the empty and first-use states exist, and in the scripted test a trainer finds the next task in under 5 s.

**Notes from Step 4**

- The red exception, pending the owner: Step 4 uses the one red (`--alert`, `#B42318`) for task states and also for destructive buttons, badges and menu items and for invalid and error states, and it ships as a fixed token in `scripts/identity/identity.lock.json`, where section 4 calls the alert color a setting. The ADR this step writes records the owner's answer on both: whether the red covers destructive and validation states, and whether a fixed token replaces the setting. In the dark theme the red reaches only 1.28:1 as text or a border on the dark background, so dark error text needs a second, lighter red or the foreground color with an icon.
- Section 4's status colors are only the alert so far. Add the success, warning and information roles here, where task states first appear, from the identity palette and held to the same contrast test.

#### Step 24. My work and my sections (M)

**Goal:** all work in one list, and each section on one page.

**Do:** one work list with filters (this week, overdue, plan, sections, assignments) kept in the URL; "My sections" as cards with progress; a section page with a header (course, reference, enrolled, schedule) and its tasks grouped by week.

**Done when:** filters survive a reload and a shared link, and the section page shows the generated tasks with the right due dates.

> **Checkpoint: Audit 8.** Run `/audit 22-24`.

#### Step 25. Evidence pipeline (L)

**Goal:** photos and files from a phone upload reliably and look right.

**Do**

- In the browser: camera capture, several photos per task, compression (longest side 2000 px and JPEG quality 0.8 by default, both settings), HEIC converted or refused with a clear message, orientation applied and location removed, PDFs passed through within the size limit, progress, retry, and resume after the page is reopened.
- On the server: file type checked by its bytes; size and type rules from settings; storage through `StorageAdapter`; SHA-256; thumbnails as jobs (sharp for images, `pdftoppm` for a PDF's first page); photos merged into one PDF on demand; downloads streamed only after an authorization check; an optional malware-scan hook.

**Done when:** tests cover a HEIC photo, a rotated JPEG, an oversized file, a renamed executable and a PDF thumbnail, and an end-to-end test uploads 10 files on a throttled network without a failure.

#### Step 26. The task card and the done flow (L)

**Goal:** one card for every kind, and finishing takes seconds.

**Do**

- The card shows status, a one-line evidence policy, the evidence slot from Step 25 and the kind's editor.
- "Done" is accepted at once and completes when uploads finish, without a blocking spinner. "Not applicable" asks for a reason. "I have a problem" offers categories and notifies the head, or the admin for technical ones.
- Notes and history on every card; returned tasks show the head's note first; optimistic updates throughout.

**Done when:** an end-to-end test per kind passes, and on iPhone emulation opening a task, adding photo evidence and marking it done takes 8 taps or fewer and 60 s or less (timed by the test).

#### Step 27. Notifications in the work loop (S)

**Goal:** few messages, all useful.

**Do:** an instant notification when work is returned; the weekly digest on Sunday; a due-tomorrow reminder only for required evidence; "nothing uploaded this week" for heads. Every rule is a setting.

**Done when:** digest snapshot tests pass, and a test counting messages over a full demo week shows no per-task reminder flood.

> **Checkpoint: Audit 9.** Run `/audit 25-27`.

#### Step 28. Profile and self-reported work (M)

**Goal:** the trainer's own contributions reach the right axes.

**Do:** professional profile (qualifications, experience, courses taught filled in from sections); initiatives and participations; professional development; e-learning evidence; advising; next-term goals. Each entry type maps to an axis through a setting, seeded with the administration's numbering: profile 4, e-learning 7, advising 8, initiatives and participations 10, goals 13 (optional). The readiness board gains "trainer profiles complete".

**Done when:** each kind of entry is stored under its configured axis, and changing the mapping setting moves it (tests); the readiness board counts complete profiles.

> **Checkpoint: Lead review E.** Run `/lead-review E`, then tag `v0.5-E`.

### Section F. Review and portfolios (steps 29 to 33)

#### Step 29. Review inbox and sampling (L)

**Goal:** a head reviews a fair sample in minutes, on a phone.

**Do**

- Sampling engine: rate and weekly cap from settings, spread across kinds and trainers, seeded so the same inputs give the same sample, and able to explain why each item was picked.
- "Requires approval" kinds chosen by the head, such as exam copies.
- The inbox: full-screen cards on phones with a thumbnail, approve or return with a note, and undo; a split view on desktop with keyboard shortcuts. Returned work notifies the trainer.
- The week's sample appears as a card on the head's Today (Step 23).

**Done when:** on iPhone emulation a head reviews 5 sampled items in under 5 minutes, undo works, and a returned task reaches the trainer with the note.

#### Step 30. What is missing, portfolio approval and exam confidentiality (M)

**Goal:** heads see gaps at a glance and approve each portfolio twice a term.

**Do**

- A trainer-by-axis grid with counts and gaps.
- Trainer portfolio approval at mid-term and at term end (dates from the calendar), showing what changed since the last approval.
- A freeze date for the department portfolio.
- Exam copies hidden from the secretary, and from anyone but their trainer and head, until the exam date.

**Done when:** approval freezes an immutable snapshot (Step 32 adds its PDF and hash), the change view is correct, and the confidentiality tests pass.

> **Checkpoint: Audit 10.** Run `/audit 28-30`.
>
> **Checkpoint: UX review 3.** Run `/ux-review 21-30` (Today, My work, section page, task card, uploads, review inbox, missing grid).

#### Step 31. Portfolio builder (M)

**Goal:** trainers watch their portfolio grow, axis by axis.

**Do:** a computed view by axis (1 to 11, plus optional 12 and 13); readiness per axis; optional curation (select, reorder, highlight); automatic cover and index. On phones: a readiness list and "Open PDF" instead of a live A4 preview.

**Done when:** a demo trainer's portfolio shows every axis with the right items, including the profile and self-reported entries from Step 28, and readiness per axis.

#### Step 32. PDF generation (L)

**Goal:** an official-looking PDF in one click.

**Do**

- Print routes on the identity template: cover with the vertical logo, gradient and wave elements; index with page numbers; one section per axis; evidence thumbnails and pages; SVG charts; a footer with version id and hash.
- Playwright in the worker renders the PDF with fonts embedded; the screen shows the job's status; results are cached by content hash.
- Two variants: internal (with evidence pages) and display (summary).

**Done when:** a full demo trainer's PDF renders in under 30 s, `pdftotext` returns correct Arabic, the cover matches its visual snapshot, the file is under 15 MB, and each approved portfolio version stores its PDF and hash.

#### Step 33. Department and college portfolios (M)

**Goal:** the department file and the college summary build themselves.

**Do:** the department portfolio from approved trainer portfolios and department items (meetings, plans, initiatives) up to the freeze date, listing what is missing; the secretary prepares the draft (order, notes, missing items) and the head approves it. The dean fills the college front matter (vision, mission, leadership message) used on college and department PDFs. A college summary for the dean and vice-dean. Quality-reviewer comments on approved portfolios, visible to their owners. Versions; every internal download logged and watermarked with the user and date; the dean downloads display versions.

**Done when:** a department PDF generates from demo data with the dean's front matter, the secretary's draft needs the head's approval, a reviewer's comment reaches the portfolio's owner, download log entries exist, and the dean cannot download the internal variant (tests).

> **Checkpoint: Audit 11.** Run `/audit 31-33`.
>
> **Checkpoint: Lead review F.** Run `/lead-review F`, then tag `v0.6-F`.

### Section G. Indicators (steps 34 to 36)

#### Step 34. Indicator engine (M)

**Goal:** every number on every chart comes from one tested definition.

**Do**

- Metric definitions as data: key, calculation id (code), filters, visibility by permission, chart type and thresholds.
- SQL views refreshed by a job every 15 minutes, and on demand for the current user.
- The three groups below. Privacy rules: no trainee names anywhere; trainer names only for heads and the vice-dean; the dean sees totals; departments compared only on framework items, never ranked.

| Group | Charts | Who sees them |
| --- | --- | --- |
| Trainer achievement | overall completion (ring); completion per axis (bars); done against due by week (two lines); completion per section (bars); assignment status (stacked bars) | the trainer, their head, the vice-dean; two of them print in the portfolio's indicators axis (a setting; seeded: axis 11) |
| General achievement | plan due and done per week; trainers per axis by status; spread of trainer completion; assignments, initiatives and improvement plans; review sample, returns and decision time; framework progress per department; on-time rate (heads and vice-dean only, never in a trainer's portfolio) | head for the department; vice-dean and dean for the college |
| Training sections | enrolled against capacity (SS01); support cases: withdrawn, dismissed, barred for absence (SF01, counts only); absence without excuse by course (SO01, when uploaded); grade distribution (from grade analyses, by band); section task completion; delivery mode | the section's trainer; the head for all sections |

**Done when:** every metric has a fixture test, and a full refresh takes under 5 s on demo data.

#### Step 35. Indicator screens (M)

**Goal:** each chart sits where its reader makes a decision.

**Do:** trainer indicators on Today and in the portfolio; section indicators on the section page; "Trainers and sections › Indicators" for heads; a college dashboard for the vice-dean; a summary for the dean. Every chart has a title that states the finding, a table toggle, CSV export and print styles.

**Done when:** every chart renders with demo data, axe passes, and visual snapshots exist.

#### Step 36. Pilot measurement (S)

**Goal:** the platform measures its own success.

**Do:** an event log (task opened, done, upload started, finished or failed, sign-in, review decision) with durations and no content; a "Pilot indicators" page for the admin and vice-dean that shows each success metric from section 1 against its threshold; an export for the report to the General Administration.

**Done when:** the metrics computed from the end-to-end runs match their expected values.

> **Checkpoint: Audit 12.** Run `/audit 34-36`.
>
> **Checkpoint: Lead review G.** Run `/lead-review G`, then tag `v0.7-G`.

### Section H. Department collaboration: the secretary's part (steps 37 and 38)

#### Step 37. Meetings and minutes (M)

**Goal:** the secretary runs department meetings inside the platform.

**Do:** schedule a meeting; agenda and attendance; minutes in a rich-text editor (Tiptap, right to left); decisions and recommendations with owners and due dates that become tasks. The secretary drafts, the head approves and publishes, and meetings feed the department portfolio.

**Done when:** an end-to-end test covers a meeting from scheduling to published minutes, including a recommendation that becomes a task.

#### Step 38. Improvement plans, documents and directory (S)

**Goal:** the department's shared work in one place.

**Do:** improvement plans created from recommendations; a versioned library of department documents; a contact directory built from people. Permissions follow the matrix.

**Done when:** an end-to-end test passes for each, and the permission-matrix test includes every new action.

> **Checkpoint: Lead review H.** Run `/lead-review H`, then tag `v0.8-H`.

### Section I. Production readiness on your laptop (steps 39 to 42)

#### Step 39. Installed app and phone polish (M)

**Goal:** on a phone it feels like an installed app.

**Do:** web manifest and icons from the identity; install guidance for iPhone and Android; an offline shell; the upload queue kept in IndexedDB and resumed when the app reopens (document the iOS limits in `docs/ops/ios.md`); web push behind its setting; 44 px targets; layouts that hold at 200% text size; a check that every input uses the digit preprocessor from Step 4; and `pnpm local:share`, which opens a temporary HTTPS tunnel so a phone can reach the laptop (for example a Cloudflare quick tunnel, which needs no account), used with demo data only.

**Done when:** a Playwright test checks the manifest, a controlling service worker and the offline shell. **You:** through `pnpm local:share`, the manual checklist in `docs/ops/ios.md` passes on a real iPhone.

> **Checkpoint: Audit 13.** Run `/audit 37-39`.

#### Step 40. Performance and security hardening (M)

**Goal:** fast and safe under real use.

**Do**

- Performance: Lighthouse CI budgets on the key routes; an index review with `EXPLAIN`; checks for N+1 queries; caching for settings and catalogs only.
- Security: the nonce Content Security Policy verified; rate limits on sign-in, uploads and actions; the OWASP ASVS level 2 checklist; an OWASP ZAP baseline scan in CI; the permission matrix re-run; a dependency audit.

**Done when:** the budgets pass in CI, the ZAP baseline reports no high findings, and `docs/ops/asvs.md` is complete.

> **Checkpoint: UX review 4.** Run `/ux-review 31-40` (portfolio, PDF, department file, indicators, meetings, documents, installed app).

#### Step 41. Production-like run on your laptop (M)

**Goal:** the platform runs on the laptop exactly as it will run online.

**Do**

- `pnpm local:up` and `pnpm local:down` start and stop `docker/compose.yml` with the production images: Caddy serving `https://localhost` with its local certificate, app, worker and PostgreSQL, set to restart with Docker Desktop.
- Application secrets are generated into a local `.env` file that git ignores, without printing them.
- `pnpm admin:create` (from Step 6) creates the first admin, then refuses to run. The pilot banner is on.
- `docs/ops/local.md` explains starting, stopping, sharing with a phone through `pnpm local:share`, and what to do after the laptop restarts.

**Done when:** `https://localhost` shows the login page from the production images, every journey passes against it, and the stack comes back by itself after a restart.

#### Step 42. Logs, backups and a timed restore on your laptop (M)

**Goal:** problems are seen early, and data comes back within the targets, even on a laptop.

**Do:** structured logs with rotation; GlitchTip for errors; continuous WAL archiving plus daily base backups (WAL-G or pgBackRest), run at the next start when the laptop was off, and restic for files, all encrypted, to a backup folder you choose outside the project (an external drive if you have one); a restore script; a runbook in `docs/ops/`. The admin gets an in-app notification when a backup fails.

**Done when:** a timed restore drill loses at most 1 minute of data and restores in at most 1 hour, and a failed backup notifies the admin.

> **Checkpoint: Audit 14.** Run `/audit 40-42`.
>
> **Checkpoint: Lead review I.** Run `/lead-review I`, then tag `v0.9-I`.

### Section J. Demo data and full testing (steps 43 to 46)

#### Step 43. Demo data completed (L)

**Goal:** a realistic college that exercises and demonstrates every screen.

**Do:** complete the demo seed that every step has extended, so `pnpm seed:demo --seed 42 --week 9` builds a full college, where `--week` sets "today" inside the term. It creates:

| Data | Amount |
| --- | --- |
| College and departments | 1 college; 3 departments: General Studies, Electrical Technology, Mechanical Technology (names live only in the demo seed) |
| People | 1 admin, the dean, the vice-dean for training, 3 heads, 3 secretaries (by assignment), 40 trainers, 1 quality reviewer; synthetic Arabic names only |
| Terms | a closed previous term, and an active 18-week term with holidays, 2 exam weeks and grade deadlines |
| Framework and plans | about 20 framework items; about 40 items in each department plan |
| Courses and sections | about 45 courses and 200 sections with schedules, from a synthetic SS01 |
| Enrollments | about 2,500, by trainee number only, from a synthetic SF01 |
| Tests | quizzes, a midterm and a final per section: question papers and answer keys as synthetic PDFs; grade analyses with realistic distributions |
| Homework | three homework samples per section, with synthetic files |
| Other work | e-learning, practices, advising, initiatives, professional development, meetings with minutes, the six assignments plus an inventory officer |
| State at the chosen week | tasks done, in progress, overdue and returned; review samples and decisions; mid-term approvals; notifications; indicators |

Every generated file carries a visible "بيانات تجريبية" watermark. The generator writes synthetic SS01, SF01 and SO01 files as XLSX on the headers in section 9, so demos and tests use the real import path. It refuses to run against the production database. `--profile alt` seeds a different college from data alone: other names, departments, roles, templates and a 16-week term.

**Done when:** the seed finishes in under 2 minutes, a second run creates no duplicates, every screen shows meaningful data at weeks 1, 9 and 18, and the `alt` profile loads.

#### Step 44. Every role's journey, end to end (L)

**Goal:** the whole app works for every role.

**Do:** Playwright journeys on demo data, on desktop and on iPhone and Android emulation, with axe checks and visual snapshots. Every journey runs in CI on the default profile, and nightly on the `alt` profile:

- **Vice-dean:** open the next term, set its calendar, publish the framework, import SS01 and SF01, follow the readiness board.
- **Head:** publish the plan, assign templates, send a quick request, transfer a section, review the sample, approve a portfolio, freeze the department file.
- **Trainer:** camera evidence, mark done, fix returned work, upload a homework sample and an exam copy, enter a grade analysis, complete the profile, open the portfolio PDF.
- **Secretary:** a meeting from agenda to published minutes; the department portfolio draft.
- **Dean:** the college front matter; indicators and approved portfolios.
- **Admin:** settings, people, the role grid, the audit log.
- **Quality reviewer:** comment on an approved portfolio.

**Then explore:** run the qa-tester agent. It loads the demo data and explores each role for 20 minutes with wrong inputs, double clicks, the back button, a slow network, and large or odd files, and records each defect in `docs/reviews/qa-44.md` with a priority from P0 to P3.

**Done when:** every journey passes in CI, with traces and videos stored as artifacts, and no P0 or P1 defect is open.

#### Step 45. Load, resilience and recovery (M)

**Goal:** proof that the stack carries the college on modest hardware; Section K repeats it on the server.

**Do:** k6 with 40 trainers uploading and 50 read requests a second for 15 minutes, about five times the expected peak; a 1-hour soak; 40 portfolio PDFs in one batch; the worker killed during a PDF job, which must retry; the restore drill repeated on demo data.

**Done when:** reads stay under 300 ms and writes under 1 s at p95 with zero errors, every job recovers, and the restore meets its targets.

> **Checkpoint: Audit 15.** Run `/audit 43-45`.

#### Step 46. Acceptance test with five trainers (M)

**Goal:** real people succeed without help.

**Do:** Claude Code prepares the session: five trainer accounts on the laptop's production-like stack (Step 41), a printed task card for each tester, a one-page guide per role in `docs/guides/`, and `docs/reviews/acceptance-46.md` for the results. **You:** run a moderated 30-minute session with five trainers, one of them over fifty, each on their own phone through `pnpm local:share`. Tasks: find this week's task, upload an exam copy by camera, mark it done, fix a returned task, open the portfolio PDF. Claude Code then fixes every P0 and P1 issue, and you repeat the session.

**Done when:** 4 of 5 finish without help within 10 minutes, and every success metric in section 1 that can be measured before launch meets its target.

> **Checkpoint: UX review 5.** Run `/ux-review 41-46`, the final consistency pass over every screen.
>
> **Checkpoint: Lead review J.** Run `/lead-review J`, then tag `v1.0-rc`.

### Section K. Going online, when you decide (steps 47 and 48)

Run this section after the product-manager gate in section 7 says Ship, whenever you choose to go online. Nothing in Sections A to J depends on it.

#### Step 47. Deploy to college.azizalmalki.com (M)

**Goal:** the login page is live at the real address, with staging beside it.

**Do**

- **You:** create an Oracle Cloud Free Tier account with Jeddah as the home region (it cannot be changed later); sign-up needs your phone and a bank card, which is not charged. Then create a `VM.Standard.A1.Flex` instance with 2 OCPUs and 12 GB of memory (the Always Free limit since June 2026), Ubuntu 24.04 for Arm, a 150 GB boot volume, an SSH key and a public IPv4 address, and allow TCP 80 and 443 from anywhere in the network's security list. If creation fails with "Out of host capacity", retry later, or upgrade to Pay As You Go: Always Free resources stay free, and a small budget alert catches any charge. In the DNS panel of azizalmalki.com, add two A records, `college` and `staging.college`, pointing to the instance's IP with a TTL of 300; if the DNS is on Cloudflare, keep both records on DNS only. Then give Claude Code the IP, the SSH user (`ubuntu`) and the path of the key file, nothing else. Claude Code records them in `docs/ops/hosting.md` and hardens the VM: SSH keys only, the instance firewall opened for 80 and 443 (Oracle's Ubuntu images ship their own iptables rules), unattended upgrades, fail2ban.
- A `staging` Compose profile with its own app, worker and database. Every merge to `main` deploys to staging and reloads `pnpm seed:demo --seed 42 --week 9`.
- Caddy with automatic TLS:

```
college.azizalmalki.com {
  encode zstd gzip
  header Strict-Transport-Security "max-age=31536000"
  reverse_proxy app:3000
}
staging.college.azizalmalki.com {
  encode zstd gzip
  reverse_proxy app-staging:3000
}
```

- GitHub Actions on a tag: build the arm64 images with Docker Buildx, push to GHCR, connect over SSH, pull, migrate, start, health check, and roll back automatically if the check fails. If emulated arm64 builds run too long, register a self-hosted runner on the server and build there.
- Secrets never enter the repo, this plan or the chat. **You:** add `DEPLOY_HOST`, `DEPLOY_USER` and a deploy-only `DEPLOY_SSH_KEY` as GitHub Actions secrets. Claude Code generates the application secrets on the server into `/opt/college/.env` (mode 600) without printing them.
- `pnpm admin:create` creates the first production admin, then refuses to run. Pages carry `noindex`, and the pilot banner is on.

**Done when:** `https://college.azizalmalki.com` shows the login page, staging shows the demo college, a deploy and a rollback have been rehearsed, and SSL Labs grades the site A or better.

#### Step 48. Monitoring, backups and restore online (M)

**Goal:** the server is watched, backed up inside the Kingdom, and proven to recover.

**Do:** the logs and GlitchTip from Step 42 on the server; an external uptime check on both addresses; the Step 42 backups pointed at Oracle Object Storage in the same region through its S3-compatible API (20 GB free; the backup report shows usage); the restore drill and the Step 45 load test repeated on the server.

**Done when:** the restore drill on the server loses at most 1 minute of data and restores in at most 1 hour, the load test meets its targets there, and an alert fires when a backup fails.

> **Checkpoint: Audit 16.** Run `/audit 46-48`.
>
> **Checkpoint: Lead review K.** Run `/lead-review K`, then tag `v1.1` and deploy it.

## 7. Final product-manager audit and the rebuild gate

After Step 46 and its checkpoints, run `/pm-audit`. The product-manager agent starts from a fresh context, judges outcomes rather than code, and writes `docs/reviews/pm-final.md`. Claude Code then acts on the verdict as this section describes.

**What the product manager checks**

1. **The teamwork closes.** One run of the whole loop with the demo people: the vice-dean opens the term and publishes the framework; the head publishes the plan and assignments; trainers deliver their work with evidence; the secretary publishes minutes; the head reviews the sample and approves portfolios; the dean reads the indicators and portfolios. Each row of "Who fills what" in section 1 is done by its own role, on its own screens, with no workaround.
2. **Every requirement is traced.** A table in the report links each requirement to a screen, a test and a result. It covers at least: the login page (at `https://localhost` now, and at `college.azizalmalki.com` after Section K); nothing hardcoded; each role's part; the premium interface; demo data for courses, sections, trainers, the dean, the vice-dean, homework and tests; and a closed report for every checkpoint in `docs/reviews/`.
3. **Nothing hardcoded, proven.** `pnpm check:hardcode` passes, and every journey passes on the `alt` profile (Step 43), a different college built from data alone, with no code change.
4. **Numbers, not impressions.** Each success metric in section 1 is reported from the Pilot indicators page and the acceptance test. Four can only be measured in the trial: sign-ins per completed task, the head's weekly review time, trainers who return in week 2, and the quality unit's answer.
5. **Less is better.** Screens, settings and options that nobody used in the acceptance test, or that needed explaining, are listed for removal or merging.
6. **Ranked improvements** in three groups: before go-live, during the trial, and after approval. Each names whom it serves, which metric it moves, and its size.

**The gate**

| Verdict | When | Then |
| --- | --- | --- |
| Ship | Every metric that can be measured before launch meets its target, no P0 or P1 defect is open, and every requirement is traced | Tag `v1.0`. When you decide to go online, run Section K, then the go-live checklist |
| Fix, then ship | Gaps remain, and no rebuild condition below applies | Add fix steps (46a, 46b and so on) in the same format, run their checkpoints on the same cadence, then run `/pm-audit` again |
| Rebuild a section | One section causes two or more missed metrics, or its core journey stays more than 50% over target after one round of fixes | Write an ADR in `docs/ADR/` on what failed and why; rebuild the section from its first step on a branch, with its tests as the specification; re-run every checkpoint from that section on |
| Rebuild the product | The core loop (task, evidence, done, review, portfolio) fails the acceptance test twice | Write an ADR; restart from Step 18 and keep Sections A to C if their reviews passed, or from Step 1 if the foundation is the cause; carry over the tests, the demo generator and the review reports |

A rebuild is part of the plan, not a failure of it. The bar is the best product for the people who use it, and the tests and reports make a second build faster than the first.

**During the trial.** Run `/pm-audit` again at week 4 and at the end of the term, with the Pilot indicators export in place of demo data. Its improvements become a new section of steps with the same checkpoints.

**Go-live checklist.** Confirm every item before the first real trainer signs in.

- The dean's written circular for the trial: its purpose, the three departments, the people, the data collected, and how long it is kept.
- Production runs in the Kingdom (Step 47), and a restore from last night's backup was timed this week (Step 48).
- The production database holds no demo data: no demo account exists, and `seed:demo` refuses to run there.
- Every admin uses two-factor sign-in, and `pnpm admin:create` refuses to run again.
- The vice-dean has entered the term with its weeks, calendar and framework; SS01 and SF01 are imported with every section matched; each head has published a plan and assignments.
- The pilot banner shows on every page.
- Support works: "I have a problem" reaches the admin, each role has a one-page guide, and each department has had a 15-minute walkthrough.
- Alerts for downtime, errors and failed backups reach the admin.
- Rollback is rehearsed: the previous image tag and a restore point.

## 8. Non-goals, risks, backlog and open decisions

**Not in version 1.** Each was left out on purpose:

- Teaching itself: no gradebook, course content, trainee attendance or trainee accounts. Rayat and Blackboard stay the systems of record; the platform keeps the evidence of the work.
- Surveys, Word export, and comparisons across terms (after two terms of data).
- A screen for running several colleges.
- Native apps: the installed web app serves phones.
- Microsoft 365 until the General Administration approves it.

**Ready by design.** Each needs an adapter or configuration later, not a redesign.

| Later | Why it is ready |
| --- | --- |
| Microsoft Entra sign-in | Better Auth takes it as one more provider |
| SharePoint storage | every file goes through `StorageAdapter`; local disk is the first adapter |
| Teams or Outlook notifications | notifications go through channels; in-app and web push come first |
| Several colleges | every tenant row carries `college_id`; roles and settings are data |
| English interface | every string is a message key; Arabic is the first locale |
| Dark theme | dark tokens are defined from the start |

**Risks**

| Risk | Mitigation |
| --- | --- |
| One developer carries the project | CLAUDE.md, ADRs, runbooks and tests as the specification; any Claude Code session can continue from the next step |
| The laptop holds the only running copy while building | the code lives on GitHub, demo data rebuilds with one command, and Step 42 backs the database and files up to a folder outside the project |
| Rayat changes its export columns | column names are settings; the import previews differences before saving and names any missing column |
| Trainers keep sending work on WhatsApp | camera evidence in under a minute, quick requests from the phone, reminders, and the head's short weekly routine; watch the week-2 return metric |
| The font license may not cover web use and PDF embedding | written confirmation before go-live; a fallback font is a one-token change |
| Approval from the General Administration takes long | the trial runs under the dean's circular, and the Pilot indicators export feeds the report |
| iPhone limits on installed web apps | uploads start at once and resume on the next open; push only after installation; limits recorded in `docs/ops/ios.md` |
| Personal data in Rayat files | only the minimal columns are kept, the raw file is discarded, data stays in the Kingdom, access follows scope, and every change is audited |
| The server fails in an exam week | continuous backups, a timed restore within 1 hour, a rehearsed rollback, and a restore drill before each exam week |
| Oracle changes its free tier, runs out of capacity, or reclaims an instance it finds idle | stay within the Always Free limits; upgrade to Pay As You Go if needed (Always Free resources stay free) with a small budget alert; Docker Compose and the backups move the platform to any VM in the Kingdom within an hour |
| Scope grows during the build | one step per session, `docs/BACKLOG.md`, and the product-manager gate |

**Backlog.** `docs/BACKLOG.md` collects the enhancements that reviewers defer, and the product manager ranks it. It starts with:

- QR verification on portfolio PDFs, when the quality unit asks for it.
- Department and term comparisons, after two terms of data.
- Surveys: trainers about the platform, trainees about courses.
- Word export of the portfolio.
- The dark theme and the English interface.
- Entra sign-in, SharePoint storage and Teams notifications, after approval.
- A view across colleges for the General Administration.

**Open decisions.** None of these blocks the build; each has a deadline.

| Decision | Who decides | Needed by |
| --- | --- | --- |
| When to go online (Section K) | you | after the product-manager gate |
| The three trial departments | the dean | go-live |
| One alert color outside the identity palette (red) | you | Step 23, where task states first appear |
| The college logo before sign-in | the dean, in writing | go-live; off until then |
| The font license covers web use and PDF embedding | the employer | go-live |

The term itself is not a build decision: the vice-dean for training enters each term, its start date, its number of weeks and its general framework in the platform (Step 13). Hosting is decided: your laptop while building, then Oracle Cloud's Always Free tier in the Jeddah region when you go online (Section K).

## 9. Appendix: Rayat export headers

Rayat exports these reports as XLSX, and the importer reads XLSX first (CSV is accepted too). The SF01 and SS01 headers below come from original exports. The column map in settings is seeded from them, and the demo generator and the test fixtures use them. Only the columns in each table are read; every other column is dropped while parsing.

**SF01, trainee registration in sections (20 columns)**

| Column | Read as |
| --- | --- |
| الفصل التدريبي | term |
| القسم | department, matched by its Rayat values |
| المقرر | course code |
| الرقم المرجعي | section reference |
| رقم المتدرب | trainee number |
| حالة تسجيل | registration status |
| حالة المتدرب | trainee status |

Dropped: الوحدة، المرحلة، التخصص، اسم المقرر، نوع الجدولة، الساعات المعتمدة، المدرب، إسم المتدرب، مرحلة، نوع التدريب، برنامج، رقم الجوال، الدرجة. The trainee name, mobile number and grade are never stored or logged.

**SS01, section schedules (31 columns).** A section can span several rows, one per meeting; the importer merges them by section reference.

| Column | Read as |
| --- | --- |
| الفصل التدريبي | term |
| القسم | department |
| المقرر | course code |
| اسم المقرر | course name |
| الساعات المعتمدة | credit hours |
| الرقم المرجعي | section reference |
| نوع الجدولة | delivery mode, such as in person or remote |
| اليوم | meeting day |
| الوقت | meeting time |
| مبنى | building |
| قاعة | room |
| سعة | capacity |
| مسجلين | enrolled |
| متبقي | remaining, used only to check that capacity equals enrolled plus remaining |
| رقم المدرب | trainer's employee number, matched to people |

Dropped: الوحدة التدريبية، جزء الفصل، ساعات المحاسبة، ساعات المحاضرة، ساعات المختبر، ساعات أخرى، ساعات الاتصال، نوع الشعبة، كل من الاستجابة الصوتية والخدمة الذاتية متاح، الحد الأقصى للمقاعد المحجوزة، المحجوزة بالفعل، المحجوزة المتبقية، الحد الأقصى للائحة الانتظار، المسجلون على لائحة الانتظار، المتبقي على لائحة الانتظار، اسم المدرب. The trainer's name comes from people, not from SS01.

**SO01, trainee absence by course (optional).** No original export was among the files, so these are the columns the current app requires; check them against an original SO01 before Step 16.

| Column | Read as |
| --- | --- |
| كود الفصل التدريبي | term code, checked against the term |
| الفصل التدريبي | term |
| اسم القسم | department |
| كود المقرر | subject code |
| رقم المقرر | course number; with the subject code it identifies the course |
| رقم المتدرب | trainee number |
| حالة المقرر | course status, such as deleted or barred for absence |
| إجمالي نسبة الغياب بدون عذر | unexcused absence, percent |
| إجمالي ساعات الغياب بدون عذر | unexcused absence, hours |
