# College Platform: Build Plan from Scratch

Oct 20, 2026 · @Aziz

This plan builds the platform from an empty repository in 48 steps across 11 sections, with a review built in every 3 steps, every 10 steps, at the end of each section, and once more at the end. Everything runs on your laptop first, in the order section 6 gives (ADR-0008). The last section, which takes the platform online, is rewritten for the hosting the General Administration chooses and is not part of this build. Each step is a focused unit of work in Claude Code: a goal, the work, and checks that prove it is done.

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
| About every three steps of the run order, where section 6's checkpoint lines say | `/audit 4-6`, or a list such as `/audit 41,7-9` | auditor agent with `/karpathy-guidelines` | `docs/reviews/audit-NN.md` and its fixes, in one review pull request |
| After steps 10, 20, 30, 40, 46 | `/ux-review 11-20` | UX and consistency expert | `docs/reviews/ux-NN.md` with screenshots, and its fixes |
| End of each section (A to J; K once it is rewritten) | `/lead-review C` | lead software engineer | `docs/reviews/lead-C.md`; must-fix items fixed; simpler flows proposed |
| After lead review F | none: the checkpoint text after Step 33 | Claude Code prepares; you present | `docs/guides/demo.md`, `docs/reviews/demo-33.md` and the saved `v0.6-F` images |
| After Step 46 | `/pm-audit` | product manager | `docs/reviews/pm-final.md`; the rebuild gate (section 7) |

When several checkpoints land on the same step, run them in this order: audit, then UX review, then lead review. A report is numbered by the last of its steps in the run order, for example `audit-06.md`, `audit-09.md` for `41,7-9`, and `ux-20.md`.

**Git rules**

- Step 1 commits to `main`. From Step 2 on, each step has its own branch, `step/NN-<slug>`, and one pull request whose squash title ends with `(step NN)`, for example `feat: sign-in (step 06)`. Merge it when CI is green, before the next step starts.
- Each review works on its own branch named after its report, such as `review/audit-06`, and merges by a pull request titled `audit: steps 4-6`, `ux: steps 11-20`, `lead: section C` or `pm: final`.
- Commit titles follow Conventional Commits.
- After each lead review, tag the section on `main`: `v0.1-A`, `v0.2-B`, and so on. Production deploys only from tags.

**Definition of done for every step**

- `pnpm check:all` passes: types, Biome lint and format, unit and integration tests, `check:hardcode`, `check:boundaries`.
- End-to-end tests for every journey the step touches pass on desktop and on iPhone emulation.
- No domain value is written in code. Names, labels, week counts, roles, axes, limits and texts come from the database, settings or message files.
- Nothing is fetched from the internet at runtime: fonts, scripts, wasm, images and PDF assets ship in the images, because the platform may run on an isolated network (ADR-0008). From Step 41 on, the end-to-end smoke also passes on the production images with outbound traffic blocked. A step that adds an environment variable, a volume or a worker dependency therefore updates `docker/compose.yml` in the same pull request.
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
| UI | Tailwind CSS v4 with tokens generated from the identity repo; shadcn/ui components (Radix) owned in the repo; Motion with the BeUI components the owner chose, each where it has a real use (ADR-0001, docs/design/beui-map.md); Lucide; Sonner; cmdk; TanStack Table and Virtual; vaul drawers | full control of a premium RTL interface on accessible primitives |
| Charts | Recharts (SVG) behind one chart wrapper | SVG stays sharp in PDFs and follows the tokens |
| Forms and validation | Zod 4 at every boundary (environment, inputs, settings, JSON payloads); react-hook-form; next-safe-action with an auth middleware | one schema from the form to the database |
| URL state | nuqs | filters and tabs survive reloads and shared links |
| Database | PostgreSQL 18 with Drizzle ORM; SQL migrations reviewed in each PR | concurrent writes, point-in-time recovery, easy for IT to host later |
| Jobs | pg-boss on the same database, run by a worker process | PDFs, imports, thumbnails, digests and metrics with retries |
| Sign-in | Better Auth: employee number or email with password; "remember this device"; TOTP two-factor (each person's choice, or required for admin keys by a setting, ADR-0014); rate limits keyed on account and IP; passkeys and a Microsoft Entra provider later (ADR-0008) | modern, self-hosted, works with Drizzle |
| Files | `StorageAdapter`: local disk now, SharePoint through Microsoft Graph after approval; sharp; poppler `pdftoppm`; compression and HEIC conversion in the browser | one interface, swappable storage |
| PDF | Playwright Chromium in the worker renders print pages | correct Arabic shaping and real CSS layout |
| Language | next-intl; Arabic by default (RTL), English catalog optional; Latin digits with Arabic month names; Hijri dates through Intl `islamic-umalqura` where a setting asks | no interface text in code |
| Tests | Vitest (unit, and integration on real PostgreSQL through Testcontainers); fast-check; Playwright (end to end, phone emulation, axe, visual snapshots); Lighthouse CI; k6 | each layer tested where it can break |
| Quality gates | Biome, `tsc`, knip, dependency-cruiser, gitleaks, CodeQL, Renovate (merges passing minor and patch updates itself, ADR-0006) | fast feedback and enforced module boundaries |
| Monitoring | pino logs with request ids; errors recorded in the platform's own database with an admin notification (ADR-0005); `/healthz` and `/readyz`; an uptime check | problems seen before users report them |
| Hosting | Now: Docker Compose on your laptop (Docker Desktop with WSL 2): Caddy with local HTTPS, app, worker with Chromium and poppler, PostgreSQL, and encrypted backups (WAL-G or pgBackRest for the database, restic for files) to a folder you choose. Later (Section K, rewritten for the choice): the same images on the host the General Administration chooses, either a server inside the college on an isolated network or a cloud VM inside the Kingdom (`docs/ops/hosting-options.md`, ADR-0008) | small, reproducible, easy to move |

**Decision change, recorded as ADR-0002.** The earlier analysis chose SQLite for a demo. A new build that holds real data for 40 or more people at once, runs a job queue, and may move to institutional hosting later is better served by PostgreSQL: concurrent writes, mature point-in-time recovery, pg-boss on the same database, and managed hosting in the Kingdom later. The cost is one more container.

**Addresses**

- On your laptop: `http://localhost:3000` while developing, and `https://localhost` for the production-like run (Step 41). A phone reaches the laptop through `pnpm local:share`, a temporary HTTPS tunnel used with demo data only (Step 41). On the college Wi-Fi, a phone that trusts Caddy's exported root reaches the laptop's LAN address (Step 41), the way phones would reach a server inside the college.
- Later, in Section K: the chosen host's address and certificate (an internal CA for a server inside the college, a public certificate in the cloud), and a staging copy of the same build with demo data only.
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
| Identity | Better Auth tables (user, session, account, two-factor); `people` (profile, employee number) | admin, the person |
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

**Owner direction (Step 5).** Motion and the identity are the platform's spirit: Motion with the BeUI components the owner chose, each adopted where it has a real use (docs/design/beui-map.md), and the identity's dark surface, gradient and art in the shell's chrome as well as on the login page, empty states and the PDF cover. Every animation stops or fades under reduced motion, and the measurable bar below still holds.

**Measurable bar**

| Check | Target |
| --- | --- |
| Lighthouse, mobile (login, Today, section page) | performance 95 or more, accessibility 100, best practices 95 or more |
| Core Web Vitals | LCP under 2.0 s on 4G, INP under 200 ms, CLS under 0.05 |
| Accessibility | axe: no serious or critical issues; WCAG 2.2 AA; touch targets 44 px; usable at 200% text size |
| JavaScript per route | 170 KB gzipped or less (not met; a measured budget is proposed in ADR-0010) |
| Server time | p95 under 300 ms for reads and under 1 s for writes |

**The login page at `/`.** A split layout on desktop and one column on phones: identity wave art, the platform and college names from settings, employee number or email, password, "remember this device", and a pilot banner whose text is a setting. Showing the college logo before sign-in is also a setting, off until the dean gives written permission.

## 5. Review agents and checkpoint commands

**Each reviewer is a Claude Code agent with a fresh context, so no one grades their own work. Reviewers only report; the main session applies the fixes on the review's branch.** Step 1 creates these files exactly as written here.

**`.claude/agents/auditor.md`**

```markdown
---
name: auditor
description: Audits a range of plan steps against the karpathy guidelines and the plan's rules. Use after every 3 steps.
tools: Read, Grep, Glob, Bash, Write
---
You audit the plan steps given as a range or a comma list in run order, for example "4-6" or "41,7-9".
You did not write this code; judge it as an outsider.
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

Write docs/reviews/audit-NN.md, where NN is the last of the steps in the run order (docs/PLAN.md, section 6):
findings by severity (blocker, major, minor), each with file:line or command output and its fix;
then at most 3 enhancements with benefit and cost.
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
5. Security: the permission matrix and the audit test (actions-audit) cover every new action; inputs validated; files authorized.
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
argument-hint: <steps>, a range or a comma list, for example 4-6 or 41,7-9
---
1. Load the karpathy-guidelines skill.
2. From an up-to-date main, create branch review/audit-NN (NN: the last of the steps in the run order, two digits).
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

**Run order (ADR-0008):** 1-6, 41, 7-29, 31, 30, 32-40, 42-46. Each step keeps its number in branches, pull request titles and references. Step 41 and Step 31 sit in this section where they run, and "the next step" means the next one in this order. This build ends with Step 46 and its checkpoints; Section K is rewritten for the hosting the General Administration chooses.

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
- Nothing is fetched from the internet at runtime (fonts, scripts, wasm, images, PDF assets):
  the platform may run on an isolated network.
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
pnpm local:up | pnpm local:down | pnpm local:share | pnpm local:run
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
- `docker/compose.dev.yml` (PostgreSQL 18; Mailpit until lead review A dropped it with SMTP) and `docker/compose.yml` (Caddy, app, worker, PostgreSQL, backup), which runs the same way on your laptop (Step 41) and on the server (Section K).
- `src/platform/config/env.ts`: one Zod schema for every environment variable; the app and the worker refuse to start on invalid values and say which one.

**Done when**

- A pull request shows every check green, and a deliberate type error fails CI.
- `docker compose -f docker/compose.dev.yml up -d` then `pnpm dev` serves the placeholder page.
- The app image is under 300 MB and the worker image builds.

**Note from ADR-0008:** the arm64 requirement existed for Oracle's Ampere VM and waits for the hosting choice. Keep choosing multi-arch images where it costs nothing, and confirm the QCT1250's processor on delivery. Step 41 updates the arm64 comment in `docker/Dockerfile`.

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

**Decisions in this step**

- Owner direction during this step: motion and the identity are the platform's spirit (section 4). The shell is BeUI's dock, shared-layout pill, bottom sheet and command palette on Motion, with the identity's dark surface, gradient and art; every other BeUI component waits for its real use (docs/design/beui-map.md).
- The header holds the search; the avatar menu (Step 6), the bell (Step 12) and the term switcher (Step 13) take their places there with their data. `print/` arrives with its first page (Step 32).

**Note from ADR-0008:** on phones, the bell and its unread count stay in the header or a bottom tab, never in the overflow sheet. Until the hosting decision, and for good on an isolated network, in-app is the only alert channel.

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
- The identity gradient (`references/palette-source.md` in the identity repo) is not a token yet; the login page's identity art adds it to the token mapping in `scripts/identity/identity.lock.json`. (Done in Step 5: `--gradient-start` and `--gradient-end`.)
- The four college logos are fetched into `public/brand/`, so `/brand/logo-*.svg` is reachable without sign-in although no page shows a logo. Keep it that way, or move the logos out of `public/`, according to the dean's answer on the logo before sign-in (section 8).

**Notes from Step 5**

- The login page is `src/app/(auth)/page.tsx`; remove the redirect from `/` to `/today` in `next.config.ts`. Replace the `viewer` constant in `src/app/(app)/layout.tsx` with the signed-in person's permissions and role keys, and put the shell behind sign-in.
- A refused page calls `forbidden()` (`src/app/(app)/forbidden.tsx`); where its 403 status matters, decide it in `src/proxy.ts`, as `/design` does.
- BeUI here (docs/design/beui-map.md): input, checkbox, alert, loader and text reveal on the login page, and the bloom menu as the avatar menu in the header.

**Notes from ADR-0008**

- Keep Better Auth's provider seam, but add no Entra provider or setting: Entra needs the server and each phone to reach Microsoft's cloud.
- Build no passkeys (docs/BACKLOG.md): a passkey binds to a hostname, and neither the hostname nor a certificate that phones trust is chosen.
- Sign-in rate limits key on the account plus the IP, not the IP alone (test), because college Wi-Fi may put a whole workshop behind one NAT address. Step 40 verifies them.
- Register the login page's settings here with their defaults, including the pilot-banner text, so that Step 41, which runs next, shows the banner without Step 7's screen.
- TOTP needs a correct server clock; on option A that means an internal time source (docs/ops/hosting-options.md).

**Decisions in this step** (ADR-0009)

- Better Auth runs inside the server only: the pages post to next-safe-action actions, and its HTTP routes are not mounted. The college's session limits apply on every request, where a session past them is deleted.
- Re-authentication: here the sensitive actions are the password change and the two-factor setup, which both ask for the password; the general step comes with its first admin action in Step 7.
- `/design` keeps the proxy's 404 outside a laptop and also requires `design.view`.
- After signing in or out, setting up two-factor or changing the password, the next page loads from scratch, so nothing typed or shown stays in the browser.

**Note from ADR-0014:** two-factor is the college's choice. The setting `auth.requireTwoFactor` (off by default) decides whether holding a key that requires two-factor sends its holder to set it up; anyone may turn it on from the profile and off with the password, and an admin turns it off for someone who lost their phone, with the temporary password's key and reach. The setup's last step sends the person on itself: to Today when it was required, back to the profile when chosen.

> **Checkpoint: Audit 2.** Run `/audit 4-6`.
>
> **Checkpoint: Lead review A.** Run `/lead-review A`, then tag `v0.1-A`.

### Section B. Production-like stack, organization, roles and settings (Step 41, then steps 7 to 12)

#### Step 41. Production-like run on your laptop (L)

*Runs after Step 6 and its checkpoints (Audit 2, Lead review A), before Step 7 (ADR-0008); its number is kept.*

**Goal:** the platform runs on the laptop as it will run under either hosting option in `docs/ops/hosting-options.md`.

**Do**

- `pnpm local:up` and `pnpm local:down` start and stop `docker/compose.yml` with the production images: Caddy serving `https://localhost` with its local certificate, app, worker and PostgreSQL, set to restart with Docker Desktop.
- Application secrets are generated into a local `.env` file that git ignores, without printing them.
- `pnpm admin:create` (from Step 6) creates the first admin, then refuses to run. The pilot banner is on.
- `docs/ops/local.md` explains starting, stopping, sharing with a phone through `pnpm local:share`, and what to do after the laptop restarts.

**Done when:** `https://localhost` shows the login page from the production images, every journey passes against it, and the stack comes back by itself after a restart.

**Notes from ADR-0008**

- `pnpm local:share` moves here from Step 39.
- Build the one-shot `migrate` service and an app database user that neither owns the tables nor is a superuser, with migrations run as the owner (both from docs/BACKLOG.md).
- Demo mode: `pnpm local:up --demo` sets `APP_ENV=staging` and runs `pnpm seed:demo` inside the stack with the options given (such as `--seed 42`), since PostgreSQL publishes no port. Without `--demo` the stack stays `production`, where `seed:demo` refuses. Steps 26 and 46 and the GA demonstration use demo mode.
- App, worker and PostgreSQL sit on a Docker network with no outbound route, and only Caddy publishes ports. Caddy also serves the laptop's LAN address from its local CA. `docs/ops/local.md` explains how to export that root to iPhone and Android, and how to start the images from `docker save` archives checked against their checksums, with no registry pull, as option A's updates on approved media would arrive.
- The pilot banner shows from the setting that Step 6 registers. "Every journey" means the journeys that exist at this point.
- Done when, added: a CI job starts the production images this way and runs the end-to-end smoke against Caddy, with the browser failing any request outside the app's origin. The worker's Chromium prints one Arabic test page to PDF on that network, and the stack starts from saved archives without a registry. **You:** add the new check to the required checks on `main`.
- **You, after the merge (it does not hold up Step 7):** on the college Wi-Fi, a phone that trusts the exported root opens the laptop's LAN address and shows the login page. The result goes into the GA request. A pass is only weak evidence for a server on another network segment, because of client isolation and VLANs.

**Notes from Step 6**

- Generate `AUTH_SECRET` (32 characters or more) into the local `.env` with the others and keep it across restarts: it signs the session cookies and encrypts the two-factor secrets, so a new one signs everyone out and makes every admin set up two-factor again (ADR-0009).
- The session cookies are Secure (`__Secure-college.session_token`), so phones use Caddy's HTTPS address, never plain HTTP. `src/proxy.ts` refuses a change whose `Origin` does not name the request's host; Caddy passes the host through, so the LAN address works as long as Caddy keeps the `Host` header.
- Caddy replaces the `X-Forwarded-For` a client sends (its default without `trusted_proxies`): the sign-in limits key on that address, and without Caddy in front a client could choose its own.
- `pnpm admin:create --name … --email … --employee-number …` prints the temporary password once; the admin replaces it at the first sign-in, then sets up two-factor from the profile, or at the next sign-in once the security settings require it (ADR-0014). The end-to-end smoke signs in the demo accounts from `pnpm seed:demo` (`db/seed/demo/accounts.ts`).

**Note from lead review A:** the PostgreSQL image tag (`postgres:18.6-alpine`) is written in six places. This step touches compose: keep the tag in one exported test constant with a Renovate `customManagers` regex, so Renovate updates every copy at once.

**Note from lead review A, on the font:** in the phone test above, also open the login page in a private tab. The text shows in the phone's Arabic font until the identity font arrives, and the page must not move when it does. With Android's Noto Naskh Arabic, tried in Chromium, the pages held still, and `src/styles/fonts.css` sizes Linux's DejaVu Sans. Apple and Windows devices draw Arabic in Arial, which next/font sizes on Latin letters only, or in a system font. Neither was measured, so an iPhone is the one to watch. If its page moves, size its Arabic font as `src/styles/fonts.css` describes, measured on that device.

**Note from Audit 2:** the demo password and the demo admin's authenticator secret are published in `db/seed/demo/accounts.ts`, and `pnpm local:share` puts demo mode behind a public tunnel. In demo mode, generate both into the local `.env` and let `seed:demo` and the smoke test read them from there; keep the published values for CI and `APP_ENV=local` only (docs/reviews/audit-06.md, minor 10).

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

**Notes from Step 5**

- The sidebar shows the college's name from `colleges`; the platform name this step seeds joins it there and in the page title. `navigation.order` is a setting already (role key to page ids).
- BeUI here: switch, select, range slider, adaptive stepper, popover (each setting's description), tabs (the groups) and action swap (save).

**Notes from Step 6**

- Step 6 registered the login and sign-in settings with their defaults: `platform.name`, `pilot.banner`, `pilot.bannerText`, `login.showLogo` and `auth.*` (password length, lockout threshold and minutes, sign-in attempts and window, idle minutes, session hours, remembered-device days). This step gives them their description keys, their edit permission and the screen.
- Re-authentication before sensitive actions (Step 6's Do, ADR-0009) arrives here with its first consumer, checking the password through `checkRetypedPassword()` (`src/modules/identity/server/retype.ts`), so it counts toward the lockout as the password change does (lead review A): changing an `auth.*` setting asks for the password again when it was last entered more than a set number of minutes ago (a new setting). Steps 9 and 10 reuse the same step for the grid and for resets.
- New actions go through `viewerAction` with the setting's permission key (`src/modules/access/server/action-client.ts`); export it from the module's `index.ts` with this first use.

**Notes from Audit 2**

- `/today` runs eight `getSetting` queries, and the college row is read three times per request (`src/i18n/locale.ts`, the pilot banner, the shell's layout). The per-request cache above can read all of the college's stored settings once, and `findCollege` can take React's `cache()` (docs/reviews/audit-06.md, enhancement 2).
- `seed:demo` stores no login setting yet: store the demo college's own `platform.name`, `pilot.bannerText` and `locale.timeZone` with the seeded defaults, and let the end-to-end login test read them from the seed (enhancement 3; `locale.timeZone` from Audit 1, folded in by lead review A). The design catalog's visual baselines show the pilot banner, so they change with the banner text.
- Sonner's `<Toaster>` mounts on `/design` only since Audit 2 (the script budget, ADR-0010). The first screen that shows a toast mounts it in its own layout.

**Notes from Step 41 (for this step and every one after it)**

- A new environment variable goes into `docker/compose.yml` and `docker/.env.example` in the same pull request. An empty value in `docker/.env.example` is a secret that `pnpm local:up` fills in.
- The app and the worker connect as a role that changes no table, schema or trigger (`db/migrate.ts`). Work that needs the tables' owner runs in a migration, or in the stack through `pnpm local:run`.
- A new journey's spec joins the list in `e2e/stack.config.ts`, which CI's Production stack job runs against Caddy on demo data. A test that makes its own rows in the database carries `@database` and stays out of it.
- `e2e/support/test.ts` fails any test whose page asks for something outside the platform's origin.

#### Step 8. Colleges and departments (S)

**Goal:** the organization is data.

**Do:** department management for admins: name, short name, Rayat matching values and active flag. From now on every tenant table carries `college_id`. No department name appears in code or in the base seed; the demo seed adds the three demo departments.

**Done when:** an admin creates three departments on the screen, their matching values are stored, and audit events exist.

**Notes from Step 5**

- Each new page adds its item to `src/app/(app)/_shell/navigation.ts` with its permission key and a `nav.<id>` message. BeUI here: table, breadcrumb (the page header's trail) and animated badge.

**Note from Step 7:** the college's own name and short name live in `colleges`, not in settings, so the settings screen does not edit them; give the college its edit form here, beside the departments, with an audit event. The sidebar and the login page already read them.

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

**Notes from Step 5**

- Seed each role's page order into the `navigation.order` setting by role key; `orderFor()` in `src/app/(app)/_shell/navigation.ts` takes the first of the viewer's roles that has one. BeUI here: combobox (the membership's person).

**Note from ADR-0008:** the membership's optional term is added in Step 13, which creates terms.

**Notes from Step 6**

- Two keys exist: `design.view` and `accounts.resetPassword`. A key marked `requiresTwoFactor` makes its holders set up two-factor before anything else; mark every key that changes access, accounts or settings that way. The `system-admin` role (`system: true`) holds every key in code, including keys added later, and `pnpm admin:create` gives it its first member; "the last admin cannot remove their own access" counts the system role's members.
- `authorize(actor, permission, scope)` and `viewerAction` take a college scope only; this step adds department and own-record scopes. Changing a role's keys takes effect at once: `getViewer()` reads them on every request.

**Note from lead review A:** `createFirstAdmin()` reads memberships by `role_id`, which no index leads, and this step queries memberships by role and deletes roles with a cascade: add the index here. The system role's membership is inserted in three places (`first-admin.ts`, `db/seed/demo/accounts.ts`, `e2e/support/accounts.ts`); this step's role assignment can give them one helper.

**Note from Audit 2:** the six actions in `src/app/(auth)/actions.ts` carry no permission on purpose: signing in is public, and the other five act on the caller's own account (ADR-0009 #6). The generated matrix test lists them as permission-free rather than flagging them.

**Notes from Step 8**

- Departments are rows of `departments` (`src/modules/org`): a name, a short name and an active flag, with their Rayat values in `department_rayat_values`, where each value is one department's in the college (its primary key). A membership's department scope references `departments.id`. Offer only active departments where someone chooses one: the form tells admins that a department set aside leaves the choices and keeps what was recorded for it.
- Two keys exist: `departments.manage` and `college.manage`, both requiring two-factor. `/departments` shows the list to the first and the college's names to the second, and its navigation item takes `departments.manage`, so a role given only `college.manage` on the grid needs the item widened then, as with the settings.

> **Checkpoint: Audit 3.** Run `/audit 41,7-9`.

**Notes from Step 7**

- Every setting is edited with `settings.manage` (two-factor required), named per setting in the registry (`src/modules/settings/domain/registry.ts`). When the grid gives a setting to another role, such as the review sample rate to the quality reviewer, give that setting its own key there; the settings screen shows each viewer the settings whose key they hold, and its navigation item takes one key, so a role with only the new key needs the item's permission widened then.
- `navigation.order` has no control on the settings screen (a map draws none); edit each role's page order with the role, on the grid.
- The grid's sensitive changes ask for the password again through `reauthenticate()` (`@/modules/identity`), as a security setting does: the action returns `passwordRequired`, the screen asks in place, and the password counts toward the lockout.

#### Step 10. People and accounts (M)

**Goal:** accounts for every role, imported in bulk and managed safely.

**Do**

- People management, and import from CSV or XLSX (employee number, name, email, department, role) with a preview, row errors and a dry run.
- Account states: invited, active, locked, disabled. Heads help their own trainers by permission: reset a password, link an employee number.
- A basic profile page; the trainer's professional profile arrives in Step 28.

**Done when:** 40 people import from a sample file with a preview; a head can reset passwords only inside their department (test); every action is audited; and `seed:demo` adds the demo people listed in Step 43.

**Notes from Step 5**

- BeUI here: table (people), animated badge (account states) and overflow actions (a person's row).

**Notes from ADR-0008**

- There is no outgoing email. "Invited" means an account with a one-time temporary password, issued by an admin or a head, shown once and audited, until Step 6's forced change.
- The email column holds each person's Microsoft 365 sign-in address, so Entra can link accounts later without a re-import.
- Imports run on synthetic files until the General Administration approves the data classification.

**Notes from Step 6**

- `createAccount()` makes a person with a credential account and, without a password, a temporary one to show once; `resetPassword()` (`src/modules/identity/server/password.ts`) gives a temporary password, ends every session, lifts a lockout, forces a change at the next sign-in and writes `account.resetPassword` without the password. The screens call them through `viewerAction` with `accounts.resetPassword` and the re-authentication step from Step 7.
- "Locked" in the account states means that one of the account's two rows in `sign_in_lockouts` (`typed:` and its email, or its employee number) reached `auth.lockoutThreshold` attempts less than `auth.lockoutMinutes` ago (`src/modules/identity/server/lockout.ts`). A reset lifts both (Audit 2). Today the only way back for an admin who has lost both the password and the authenticator is another admin (docs/BACKLOG.md).

**Note from lead review A:** the account menu's "change password" has integration tests but no end-to-end test; add one with this step's profile item in the menu.

**Note from Audit 2:** `createAccount()` writes no audit event itself; only `createFirstAdmin()` adds `account.create`. This step's import and invite actions write it too.

**Note from Step 7:** a reset of someone's password asks for the admin's own password again through `reauthenticate()`, as the settings screen does for security settings (`src/app/(app)/settings/actions.ts`).

**Note from Step 8:** an import row's department matches a department's name, short name or Rayat values (`listDepartments()`), each tidied as `oneLine()` tidies them and compared through `foldCase()` (both in `src/platform/validation/text.ts`); a department that matches none is a row error, never a new department. Since Audit 3, no text names two departments of the college in any of the three, in any case of its Latin letters, so a match is never ambiguous.

**Notes from Step 9**

- A person's roles are memberships: a role across the college or in one department (`addMembership()`, `removeMembership()` in `src/modules/access`, each audited). The import's role column becomes memberships through `addMembership()`; `joinRole()` is for the seeds and the tests only. A person's department is the department of their department-scoped memberships.
- A head's help for their own trainers checks the key in the trainer's department: `ctx.requirePermission("accounts.resetPassword", { departmentId })`, which a head's department-scoped membership passes and nothing outside it does. Give the head role that key on the grid's default (`db/seed/base.ts`) with this step.
- **From Audit 3:** the base seed gives a default role its keys only when it creates the role, so a re-run never undoes the grid; a college that exists already, such as a running production-like stack, gets no new default key from it. Add each new default key in this step's migration too: `insert into role_permissions (role_id, permission) select id, 'accounts.resetPassword' from roles where key = 'head' on conflict do nothing`. The keys of Steps 33 and 37 arrive the same way.
- **From Audit 5:** a setting that a role's own key also edits follows that key's two-factor mark, not `settings.manage`'s. `term.manage` edits the three calendar settings (Step 13) and asks for no two-factor, as the owner keeps two-factor optional (ADR-0014); marking it would make the demo vice-dean enter a code at every sign-in.

> **Checkpoint: UX review 1.** Run `/ux-review 1-10` (login, shell, design page, settings, departments, roles, people).
>
> **Before it (lead review A):** capture the screens from the production build, which has no Next.js dev-tools button: `pnpm build`, copy `.next/static` and `public` into `.next/standalone` as CI does, then `CI=1 pnpm e2e:screens`. The review decides the scale of the 390 px captures, which are 1170 px wide today (`scale: "css"`); PR #6 left that question to it.
>
> **From Step 7:** the settings screen shows each description under its label rather than in BeUI's popover, saves one setting at a time with its own button, and asks for the password in the row; review those choices, the search's Arabic matching, and whether `ui/switch`, `ui/select` and `ui/tabs` leave the catalog now that their BeUI counterparts are in use.
>
> **From Step 8:** on a phone the departments list leaves out how Rayat writes each department, and the college's names sit in a card under the list; the department form saves all its fields with one button, where the settings save one at a time. Two details seen while capturing the screens: the stepper's value has a dashed outline on a desktop that looks rough, and content scrolled under the sticky header shows through its translucent fill.
>
> **From Step 9:** the roles screens: the grid as one column of switches per role on its own page (a matrix of every role at once does not fit a phone), the members' combobox and scope, the password asked in the card that makes the change, and the page order moved with up and down buttons rather than by dragging.
>
> **From Step 10:** the people screens: a "…" in each row that rests quietly and opens into the account's actions, each confirmed in a bottom sheet; the import's three stages on one page (the file, the preview, the result with the passwords shown once); the person's page with two forms (name and email, employee number); and the profile. A phone leaves out the email and the roles, which the person's page shows.

**Note from ADR-0016:** a person's page also gives them a role, across the college or in one active department, for whoever holds `roles.manage`, through the role page's own action (`addMembershipAction`): the same key, password step, event and notification. Taking a role away stays on the role's page.

#### Step 11. Audit log and history (S)

**Goal:** every change can be traced.

**Do:** append-only `audit_events` (actor, action, entity, diff, IP, user agent, time); an admin viewer with filters, search and export; a history panel reused on entity pages; retention as a setting.

**Done when:** a test lists every server action and asserts each one writes an event, and the viewer pages through 100,000 events in under 300 ms.

**Note from Audit 1:** `db/migrations/0001_audit_events_append_only.sql` rejects every `UPDATE`, `DELETE` and `TRUNCATE` on `audit_events`, so the retention purge needs its own allowed path past those triggers, and so does any backfill in a later migration. The triggers stop mistakes, not the table owner, which is the app's own database user.

**Notes from Step 5**

- With the administration pages the sidebar gets its first group: move it onto BeUI's animated sidebar. A viewer with more than five pages gets the phone's "More" sheet: add its end-to-end test then. BeUI here also: table (virtualized), date range picker and collapsible.

**Note from ADR-0008:** Step 41 runs before this step and gives the app a database user that does not own the tables. The retention purge therefore runs through the table owner, and the triggers now bind the app. The retention default follows the data classification the General Administration approves; it is already a setting.

**Note from Step 6:** the events so far are `session.signIn`, `session.signOut`, `account.lock` (no actor: the system locked it), `account.create`, `account.resetPassword`, `account.changePassword`, `account.startTwoFactorSetup` and `account.enableTwoFactor`. A failed sign-in writes an event only when it locks the account, so the test that every server action writes an event treats the sign-in and code actions by their outcome.

**Note from Audit 2:** Better Auth locks two-factor for 15 minutes after ten wrong codes in a row (five per challenge), a library default rather than a setting, and writes no event. Add one with the others here, written once per lock: `verifySignInCode()` returns `locked` (`src/modules/identity/server/two-factor.ts`).

**Note from Step 9:** the grid writes `role.create`, `role.update` (names, or keys before and after), `membership.create` and `membership.delete` (person, role key and department); show them on a role's history panel with the keys' and the departments' names.

**Note from Step 10:** the people pages add `account.disable`, `account.enable`, `person.update` (name and email before and after) and `person.linkEmployeeNumber`, and the import writes `account.create` and `membership.create` for each row it adds. A person's page is the first to take the history panel.

**Note from Audit 3:** `needsPassword()` asks for the password again for the settings of the `security` group only (`src/modules/settings/domain/registry.ts`). The retention setting decides how long history is kept, so it asks too: give the registry a `reauth` flag beside `permission`, set it on the security settings and on retention, and extend the settings actions' test to it.

**Note from Audit 4:** retention never goes under 12 months. The setting's schema refuses less (`min(12)`), and so does `purge_audit_events()` (migration `0010`), the table owner's only way past the append-only triggers, so the app's own user cannot shorten history. If the data classification the General Administration approves asks for less than a year, that takes a migration. The default is 60 months.

#### Step 12. Notifications foundation (M)

**Goal:** people hear about what matters and nothing else.

**Do**

- Notifications table, a bell with an unread count, and a notification center.
- Preferences per kind and channel; message templates as data with variables.
- A weekly digest job, Sunday 7:00 by default; an SMTP email adapter, off by default; web push (VAPID) behind a setting, for the installed app.

**Done when:** the digest job produces the expected in-app digest for a fixture (snapshot test), and switching email on or off is a setting, not a code change.

**Notes from Step 5**

- The bell goes in the header (`src/app/(app)/_shell/header.tsx`) as BeUI's notification stack, with an animated badge for the unread count.

**Notes from ADR-0008**

- Build only the in-app channel: the bell, the notification center, preferences per kind (the channel stays a column whose only value is in-app), message templates and the Sunday digest.
- The SMTP adapter and web push (VAPID) wait for the hosting decision (docs/BACKLOG.md), because an isolated server can send neither. Lead review A dropped `SMTP_URL` and Mailpit; the step that adds SMTP after the hosting decision brings them back.
- Done when, replaced: the digest reaches the in-app channel for a fixture (snapshot test), and a kind the person muted is not delivered (test).

**Note from Step 11:** each server action a step adds gets its line in `tests/integration/actions-audit.test.ts`, with the events it writes, which fails until it has one. A new action gets its name and its group's under `audit.actions` and `audit.groups` in `messages/ar.json` (`describe.test.ts` fails without them), and an event about a new kind of record names it in `src/app/(app)/audit/describe.ts`, as the log and the history panels show it. A record's page takes the history panel (`src/app/(app)/audit/history-panel.tsx`) with what names it.

> **Checkpoint: Audit 4.** Run `/audit 10-12`.
>
> **Checkpoint: Lead review B.** Run `/lead-review B`, then tag `v0.2-B`.

**Note from ADR-0015:** each card on the bell's stack opens its notification and marks it read, as a row of the center does: with the stack closed, the newest opens with one tap, and the stack's foot opens the list, then leads to the center. A digest keeps the ids of what it names and is read with the last of them, in the same `notification.read` event. Step 27's reminders reach the trainer the same way.

**Note from ADR-0017 (the owner's request):** announcements. A head announces to their department, and the dean and the vice-dean to the college or one department, with the scoped key `announcements.publish` (the roles grid moves it). An announcement is a title and a short text; publishing tells every enabled account in its scope but its author at once, as a notification of the kind `announcement`, which no one turns off. It opens on their next page, in the middle, over the page blurred, newest first, until each is closed, which reads it; it stays in the center. `/announcements` holds the form and the live announcements of the viewer's scopes, and withdrawing one takes it from every bell and center. Publishing and withdrawing write `announcement.publish` and `announcement.withdraw`. Whoever may withdraw a live announcement sees how many of those it reached have read it, counted from its notifications (the owner's answer).

### Section C. Term, framework and Rayat: the vice-dean's part (steps 13 to 17)

**Note from Step 7:** the digest's day and hour are settings already (`reminders.digestDay`, Sunday, and `reminders.digestHour`, 7, on the college's clock); the job reads them.

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

**Notes from Step 5**

- The term switcher goes in the header as BeUI's morph select; holidays and exam weeks use the date range picker and the number of weeks the adaptive stepper.

**Notes from ADR-0008**

- `pnpm seed:demo --week N` (default 9) moves here from Step 43. The demo term starts on the date that puts today in week N (test), and every later step seeds its states relative to it. Step 43 keeps the full amounts, the closed previous term and the `alt` profile.
- Memberships gain their optional term here (see Step 9).

**Note from Step 41:** `pnpm local:up --demo` passes `--seed` to `seed:demo`; give `scripts/local.ts` the `--week` option too, since the GA demonstration starts the stack with `--week 9`.

**Note from Step 12:** the header holds the search, the bell and the account menu (`src/app/(app)/_shell/header.tsx`); the term switcher takes its place before the bell. The bell's panel hangs from the header, not from a popover, so the morph popover stays off every page's script (ADR-0010); a morph select in the header adds its own cost to every page, to measure here.

**Note from Step 7:** the first day of the week (`locale.weekStart`) and the digits (`locale.digits`) travel in next-intl's locale (`ar-u-fw-sun-nu-latn`, `src/i18n/locale.ts`): `firstDayOfWeek()` in `src/platform/i18n/language.ts` reads the first, and the calendar already takes both. Hijri display is the setting `locale.hijri`; Today shows the Umm al-Qura date with `Intl.DateTimeFormat` and `calendar: "islamic-umalqura"` (next-intl's formatter does not take that calendar). Week utilities show it the same way.

**Notes from Step 9**

- The membership's optional term is a nullable `term_id` on `memberships`; add it to `memberships_scope_unique`, so a person can hold a role in one term and not the next.
- The keys of the steps ahead exist already (`src/modules/access/domain/permissions.ts`), each with its first step, and the default grid gives them to the vice-dean, the head, the trainer and the dean. A department's records check the key in their department: `ctx.requirePermission(key, { departmentId })`; a list keeps to `ctx.departmentsFor(key)` ("college" or the departments); a record of one's own adds `ownerId`. A new action gets its row in `tests/unit/permission-matrix.test.ts`, which fails until it has one, and a department-scoped action adds department rows there.

**Note from Step 11:** the date range picker is `src/components/motion/date-range-picker`, controlled, with its words from `dateRange` in `messages/ar.json`; `useDateRangeWords` (`src/components/use-date-range-words.ts`, shared with the design catalog since UX review 1) builds them. Its days are calendar dates (YYYY-MM-DD): `startOfDay()` and `wallClock()` in `src/platform/i18n/time-zone.ts` turn them into instants on the college's clock and back.

**Note from ADR-0018 (the owner's request):** the Eid breaks, ten years ahead. The base seed adds the college's Eid al-Fitr and Eid al-Adha breaks for the current Hijri year and the nine after it, each estimated from the averages of past Saudi calendars (docs/reviews/eid-breaks.md) and fitted to whole weeks, with Eid's date from the Umm al-Qura calendar Intl carries. Every term counts the breaks that fall in it with its own holidays, and the vice-dean adjusts each year's break on `/terms` once it is announced (`holiday.update`); a break that has begun stays as it was. Amended the same day: Founding Day joins the ten years, moved off the weekend as the official rule says, and the Eid al-Fitr break is named for Ramadan too; `/terms` shows only the current Umm al-Qura year's holidays; and the vice-dean approves an estimate as it is (`holiday.approve`) or adjusts it.

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

**Note from ADR-0008:** this step creates the kinds registry with the kind keys its items use, and Step 18 adds each kind's payload, editor and view. The due-rule and evidence-policy shapes are defined here, and Step 18 reuses them. The counting function is unit-tested on fixtures; per-section counts come from real sections once Step 17 has created them.

**Note from Step 14:** the axes are `axes` and `axis_groups` (`src/modules/axes`), found by their code (`axes_code_unique`); `listAxes()` gives the groups in order with their axes. An item that points at an axis needs `unique(college_id, id)` on `axes` for its composite foreign key, added with the first such table. Every axis is the administration's, so `axes.manage`, the admin's key, guards them all and no per-axis `locked` column is stored; add one only if a college may add axes of its own.

**Note from Step 13:** the wizard is `openNextTerm()` (`src/modules/terms/server/terms.ts`), behind the term page's "فتح الفصل التالي". It makes the next term in one transaction and copies the calendar, except its holidays, to the same weeks; the framework's draft copy joins that transaction.

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

**Note from Step 8:** match the department column against `department_rayat_values` after `oneLine()`, the tidying a value gets before it is stored, and through `foldCase()` (both in `src/platform/validation/text.ts`), the folding the departments' own check uses (Audit 3). A value belongs to one department of the college, in any case of its Latin letters, so a match is never ambiguous; a value that matches none is a row error that points to the departments screen, where an admin adds it to its department.

**Note from Step 10:** `readTable()` (`src/platform/files/table.ts`) reads an XLSX or CSV file into rows of text with read-excel-file and Papa Parse, and reads a CSV that is not UTF-8 as Windows-1256, which Arabic Excel saves. The people import is this step's shape on a small scale: a header row matched through `foldCase()`, a plan per row that writes nothing (the preview and the dry run in one), and one transaction under the college's lock that plans again before it writes.

**Note from Step 13:** a term's name is unique in its college, so a file's `الفصل التدريبي` finds its term by name. The demo term's name, "الفصل التدريبي الأول 1448", is a guess at Rayat's wording, and terms have no code column yet.

#### Step 17. Courses, sections, enrollments and transfers (M)

**Goal:** every section has its trainer, schedule and numbers.

**Do:** courses (code, name, hours); sections linked to trainers by employee number, with a report of unmatched trainers; enrollments; section transfers by heads (reason, effective week) following the rules in section 3; conflicts with a newer SS01 flagged for review.

**Done when:** unit tests prove the transfer rules (completed work stays, open work moves), and the unmatched report lists trainers missing from people.

**Note from Step 15:** the framework's preview counts each department's sections for items that reach "each section's trainer"; `src/app/(app)/framework/page.tsx` passes 0 until this step gives `countTasks()` each department's sections.

> **Checkpoint: Lead review C.** Run `/lead-review C`, then tag `v0.3-C`.

### Section D. Department planning: the head's part (steps 18 to 22)

#### Step 18. Task kinds and section templates (L)

**Goal:** every kind of work the college asks for is a kind with a schema, an editor and a view.

**Do**

- The kinds registry from section 3, each kind with a Zod payload, an editor, a read view and indicator mappings.
- Catalogs as data: training methods, development types, exam types, grade bands.
- Section templates at college level (from the framework) and at department level (by the head). Examples: midterm and final exam copies, quizzes, three homework samples, a grade analysis after each exam, e-learning setup, training practices. Due rules can follow the calendar, such as one week after the midterm exam week.

**Done when:** payload validation is tested for every kind, a head creates section templates on the screen, every template points to an axis, and the Step 13 wizard copies templates as drafts.

**Note from ADR-0008:** the kinds registry and the due-rule and evidence-policy shapes exist from Step 15. This step adds payloads, editors, read views and catalogs. Indicator mappings arrive with Step 34, their first use.

**Note from Step 15:** the registry is `taskKinds`, and the shapes are `dueRule`, `evidencePolicy` and `appliesTo` (a role's holders in each department, or each section's trainer), all in `src/modules/framework/domain/inputs.ts`; export the shapes from the module when templates use them. A rule after a calendar day counts each day of that kind in the term ("after each exam week"). The wizard copies the framework through `openNextTerm()`'s last argument, which the templates' copy joins.

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

**Note from Step 15:** the preview's count is `countTasks()` (`src/modules/framework/domain/count.ts`): each item, in each department, once per holder or section it reaches and per time its rule is due (`occurrences()`). A rule is due only in the term's numbered weeks: "a week after each exam" counts no task for the finals in the term's last week, as week 19 of 18 counts none (Audit 5). The engine generates exactly those, so the two agree by construction. A published version never changes; the engine reads the latest published version of the term.

**Note from Step 13:** a term's weeks are `termWeeks(calendarOf(term, term.events, settings, term.breaks))` from `@/modules/terms`, and `weekOf()` gives a day's week. A week that holidays fill has no number while `calendar.skipHolidayWeeks` is on. Adjusting an Eid break moves the later weeks of the terms it falls in (ADR-0018).

> **Checkpoint: UX review 2.** Run `/ux-review 11-20` (audit log, notifications, term and framework, Rayat import, sections, templates, plan editor).

#### Step 21. Assignments (M)

**Goal:** heads give trainers extra responsibilities, each with its own tasks.

**Do**

- Assignment templates as data. Seed the six from today's app: department secretary, specialty supervisor, workshops and labs supervisor, schedule coordinator, cooperative training coordinator, safety supervisor. Heads add more, such as inventory officer.
- Assign a template to one or more trainers for a term or a date range; its tasks are generated under the axis set on the template (seeded: axis 9), and Step 24's work list shows them.
- A template may grant a role. By default only the secretary template does, granting the secretary's permissions in that department.

**Done when:** assigning the secretary template grants the secretary permissions, revoking it removes them, and the template's tasks exist for the assignee (tests).

**Note from Step 10:** `seed:demo` makes the first generated trainer of each department its secretary through a membership (`db/seed/demo/people.ts`). This step's seed gives them the secretary assignment instead, which grants the role, and drops that membership.

**Notes from Step 5**

- BeUI here: multi select (the assignment's trainers).

> **Checkpoint: Audit 7.** Run `/audit 19-21`.

#### Step 22. Quick requests and the term readiness board (M)

**Goal:** urgent requests without opening the plan editor, and one board that shows who still owes what.

**Do**

- Quick request: title, due date, targets (everyone, a role, chosen people), evidence yes or no. Tasks are created at once and recorded as ad-hoc plan items.
- Term readiness board: each role's open responsibilities, with owner and link. It covers the term and framework published, people imported, Rayat imported and matched, and each department plan published; Step 28 adds trainer profiles. The vice-dean, dean and heads see it.

**Done when:** a head sends a quick request to 12 trainers in under 30 seconds, and the board turns fully green for the demo term once every input exists (integration test).

**Notes from Step 5**

- BeUI here: expandable control (the quick-request button), multi select (chosen people) and animated badge (readiness).

**Note from Step 12:** a request that tells its targets uses `notify()` with a kind of its own: the kind and its page in `src/modules/notifications/domain/kinds.ts`, its params' type there, and its words under `notifications.kinds.<kind>` in `messages/ar.json` (a label and a hint for the preferences, a title and a description filled with the params). The preferences list it on their own, and a person who turned it off is not told.

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

**Notes from Step 5**

- Today already greets with the time of day and the date on the college's clock (`src/app/(app)/today/`). BeUI here: pull to refresh on phones and expandable control (the head's one-tap reminder).

**Note from ADR-0008:** on option A, Today and the bell are the only way trainers and heads learn about work, and the head's reminders are in-app. "Nothing uploaded this week" and its one-tap reminder move to Step 27, after evidence exists (Step 25).

**Note from Step 7:** the settings screen draws its controls from the schemas and has no "token reference" control yet, since no setting names a token. If the ADR keeps the alert color a setting, its schema names the allowed tokens and the screen gets that control here.

**Note from Audit 3:** Step 9 seeded no page order, so every role follows the order the code lists the pages in (`navigation.order` is `{}`). Where a role's home first needs its pages in another order, seed that role's order under its key, merged into the setting with `setSetting`'s updater, and give existing colleges the same order in the step's migration.

**Note from Step 13:** Today already shows the week of the term on view. Pages that show a term's work read that term with `viewedTerm()` (`src/app/(app)/_shell/term.ts`), which follows the header's switcher.

#### Step 24. My work and my sections (M)

**Goal:** all work in one list, and each section on one page.

**Do:** one work list with filters (this week, overdue, plan, sections, assignments) kept in the URL; "My sections" as cards with progress; a section page with a header (course, reference, enrolled, schedule) and its tasks grouped by week.

**Done when:** filters survive a reload and a shared link, and the section page shows the generated tasks with the right due dates.

**Notes from Step 5**

- BeUI here: tabs (the work list's filters), preview rail (the weeks) and morphing tabs (the section page).

> **Checkpoint: Audit 8.** Run `/audit 22-24`.

#### Step 25. Evidence pipeline (L)

**Goal:** photos and files from a phone upload reliably and look right.

**Do**

- In the browser: camera capture, several photos per task, compression (longest side 2000 px and JPEG quality 0.8 by default, both settings), HEIC converted or refused with a clear message, orientation applied and location removed, PDFs passed through within the size limit, progress, retry, and resume after the page is reopened.
- On the server: file type checked by its bytes; size and type rules from settings; storage through `StorageAdapter`; SHA-256; thumbnails as jobs (sharp for images, `pdftoppm` for a PDF's first page); photos merged into one PDF on demand; downloads streamed only after an authorization check; an optional malware-scan hook.

**Done when:** tests cover a HEIC photo, a rotated JPEG, an oversized file, a renamed executable and a PDF thumbnail, and an end-to-end test uploads 10 files on a throttled network without a failure.

**Notes from Step 5**

- BeUI here: project folder (a task's evidence) and loader (upload progress).

**Notes from ADR-0008**

- HEIC conversion and compression ship in the app bundle; nothing comes from a CDN, and no wasm is fetched at runtime.
- `StorageAdapter` is local disk only. The malware-scan hook stays optional and off; on option A its signatures would arrive on approved media.
- The IndexedDB queue is built here, because resuming after the page is reopened needs the files saved. On option A, a photo taken outside Wi-Fi coverage waits in it. Step 39's service worker wraps it.
- Set the size and compression defaults against a 1 TB disk.
- Seeded files carry the visible demo watermark from this step on, not only from Step 43.
- The end-to-end upload test runs on a minimal task page, which Step 26 turns into the card.

**Note from Step 7:** the size limit and the accepted extensions are settings already (`files.maxSizeMb`, 20, and `files.acceptedTypes`); a framework item's own types narrow them.

#### Step 26. The task card and the done flow (L)

**Goal:** one card for every kind, and finishing takes seconds.

**Do**

- The card shows status, a one-line evidence policy, the evidence slot from Step 25 and the kind's editor.
- "Done" is accepted at once and completes when uploads finish, without a blocking spinner. "Not applicable" asks for a reason. "I have a problem" offers categories and notifies the head, or the admin for technical ones.
- Notes and history on every card; returned tasks show the head's note first; optimistic updates throughout.

**Done when:** an end-to-end test per kind passes, and on iPhone emulation opening a task, adding photo evidence and marking it done takes 8 taps or fewer and 60 s or less (timed by the test).

**Notes from Step 5**

- BeUI here: animated badge (status), action swap ("Done") and overflow actions (the card's other actions).

**Note from Step 10:** the overflow actions (`src/components/motion/overflow-actions.tsx`) take overflow items only; BeUI's primary actions beside the toggle come back here if the card shows one outside the group.

**Notes from ADR-0008**

- "I have a problem" notifies the head or the admin in-app only.
- With Step 12's `notify()` and a kind of its own (the note under Step 22 says how). A kind about one record (this task) opens that record's page: the kind's page, a fixed path today, becomes a function of its params.
- The head's note on returned work moves to Step 29, which records it.
- **You (added to Done when):** with Step 41's stack in demo mode, open a demo task on a real iPhone and on an Android phone, add camera evidence and mark it done. Do it once through `pnpm local:share` on cellular, and once on the college Wi-Fi with the exported root trusted. Claude Code records what emulation missed in `docs/ops/ios.md`, which Step 39 completes, and fixes it in this step's pull request.

#### Step 27. Notifications in the work loop (S)

**Goal:** few messages, all useful.

**Do:** an instant notification when work is returned; the weekly digest on Sunday; a due-tomorrow reminder only for required evidence; "nothing uploaded this week" for heads. Every rule is a setting.

**Done when:** digest snapshot tests pass, and a test counting messages over a full demo week shows no per-task reminder flood.

**Note from ADR-0008:** every rule is an in-app item: the digest, the due-tomorrow reminder, and "nothing uploaded this week" with the head's one-tap reminder (moved from Step 23). Step 29 sends the instant notification on returned work, since it builds the return action. On option A, people see these items only when they open the app on the college Wi-Fi, so the week-2 return metric reads differently under each hosting option.

**Note from Step 7:** the rules are settings already: `reminders.dueTomorrow` and `reminders.nothingUploaded` (both on), with the digest's day and hour from Step 12.

**Note from Step 12:** the worker's `notification-digest` job looks every quarter of an hour and calls `sendWeeklyDigests()` (`src/modules/notifications/server/digest.ts`) within a day of each college's digest moment. Today a digest counts the week's unread notifications and names the newest three (`digestOf()`, words `notifications.kinds.weeklyDigest`); the work loop's parts join its params and its words here, and the snapshot test (`tests/integration/notification-digest.test.ts`) grows with them. A reminder that must reach a person once, such as due-tomorrow per task and day, passes a once key as the digest does per week, so a rerun sends nothing twice. The message count over a demo week can read the `notifications` table.

> **Checkpoint: Audit 9.** Run `/audit 25-27`.

#### Step 28. Profile and self-reported work (M)

**Goal:** the trainer's own contributions reach the right axes.

**Do:** professional profile (qualifications, experience, courses taught filled in from sections); initiatives and participations; professional development; e-learning evidence; advising; next-term goals. Each entry type maps to an axis through a setting, seeded with the administration's numbering: profile 4, e-learning 7, advising 8, initiatives and participations 10, goals 13 (optional). The readiness board gains "trainer profiles complete".

**Done when:** each kind of entry is stored under its configured axis, and changing the mapping setting moves it (tests); the readiness board counts complete profiles.

**Note from Step 14:** the mapping setting names each axis by its code ("4", "7"...), the key the base seed gives the administration's axes.

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

**Notes from Step 5**

- BeUI here: expandable action bar (the review card) and multi select (kinds that require approval).

**Note from ADR-0008:** the task card shows the head's note first on returned work (moved from Step 26), and the return notice is in-app. On option A, heads review on the college Wi-Fi.

**Note from Step 7:** the rate and the cap are settings already: `review.sampleRate` (20%) and `review.weeklyCap` (30 per reviewer a week).

**Note from Step 12:** the return notice is a notification kind that opens the task (see the notes under Steps 22 and 26), sent in the transaction that records the decision, as a membership's notice is (`insertMembership()`).

#### Step 31. Portfolio builder (M)

*Runs after Step 29 and before Step 30 (ADR-0008); its number is kept. "Open PDF" on phones is wired in Step 32.*

**Goal:** trainers watch their portfolio grow, axis by axis.

**Do:** a computed view by axis (1 to 11, plus optional 12 and 13); readiness per axis; optional curation (select, reorder, highlight); automatic cover and index. On phones: a readiness list and "Open PDF" instead of a live A4 preview.

**Done when:** a demo trainer's portfolio shows every axis with the right items, including the profile and self-reported entries from Step 28, and readiness per axis.

**Notes from Step 5**

- BeUI here: bouncy accordion (the axes).

**Note from Step 14:** the closing group (axes 12 and 13, code `closing` in `db/seed/base.ts`) is the optional one; nothing marks it optional yet, so this step adds that marker when it treats the group differently.

> **Checkpoint: Audit 10.** Run `/audit 28,29,31`.

#### Step 30. What is missing, portfolio approval and exam confidentiality (M)

**Goal:** heads see gaps at a glance and approve each portfolio twice a term.

**Do**

- A trainer-by-axis grid with counts and gaps.
- Trainer portfolio approval at mid-term and at term end (dates from the calendar), showing what changed since the last approval.
- A freeze date for the department portfolio.
- Exam copies hidden from the secretary, and from anyone but their trainer and head, until the exam date.

**Done when:** approval freezes an immutable snapshot (Step 32 adds its PDF and hash), the change view is correct, and the confidentiality tests pass.

**Note from ADR-0008:** Step 31 runs first, so the approval snapshot, the change view and the trainer-by-axis grid read its portfolio view by axis, curation included.

> **Checkpoint: UX review 3.** Run `/ux-review 21-30` (Today, My work, section page, task card, uploads, review inbox, missing grid).

#### Step 32. PDF generation (L)

**Goal:** an official-looking PDF in one click.

**Do**

- Print routes on the identity template: cover with the vertical logo, gradient and wave elements; index with page numbers; one section per axis; evidence thumbnails and pages; SVG charts; a footer with version id and hash.
- Playwright in the worker renders the PDF with fonts embedded; the screen shows the job's status; results are cached by content hash.
- Two variants: internal (with evidence pages) and display (summary).

**Done when:** a full demo trainer's PDF renders in under 30 s, `pdftotext` returns correct Arabic, the cover matches its visual snapshot, the file is under 15 MB, and each approved portfolio version stores its PDF and hash.

**Notes from Step 5**

- Print routes go in `src/app/print/`, outside the `(app)` shell. BeUI here: text shimmer while the PDF renders.

**Note from ADR-0008:** the worker's Chromium aborts every request that does not go to the app, and the app serves the fonts and images. A test proves a render completes with outbound traffic blocked. Axis 11's charts come with Step 35, which adds trainer indicators to the portfolio. The font-embedding license is settled before any demo PDF leaves the college; until then the GA demonstration uses the fallback font.

**Note from Step 41:** the worker image already carries Chromium, poppler and the identity font, and `node worker/print-check.ts` prints an Arabic page to PDF on the stack's network, which has no route out (CI's Production stack job runs it). It starts Chromium without its sandbox, which needs privileges a container lacks: Step 40 reviews that.

#### Step 33. Department and college portfolios (M)

**Goal:** the department file and the college summary build themselves.

**Do:** the department portfolio from approved trainer portfolios and department items (meetings, plans, initiatives) up to the freeze date, listing what is missing; the secretary prepares the draft (order, notes, missing items) and the head approves it. The dean fills the college front matter (vision, mission, leadership message) used on college and department PDFs. A college summary for the dean and vice-dean. Quality-reviewer comments on approved portfolios, visible to their owners. Versions; every internal download logged and watermarked with the user and date; the dean downloads display versions.

**Done when:** a department PDF generates from demo data with the dean's front matter, the secretary's draft needs the head's approval, a reviewer's comment reaches the portfolio's owner, download log entries exist, and the dean cannot download the internal variant (tests).

**Note from ADR-0008:** meetings join the department portfolio in Step 37.

**Note from Audit 3:** the secretary's and the quality reviewer's keys this step adds go to their default roles in `db/seed/base.ts` and, for colleges that exist already, in this step's migration (the note from Audit 3 under Step 10).

> **Checkpoint: Audit 11.** Run `/audit 30,32,33`.
>
> **Checkpoint: Lead review F.** Run `/lead-review F`, then tag `v0.6-F`.
>
> **Checkpoint: GA demonstration (ADR-0008; it does not hold up Step 34).** On branch `review/demo-33`, in a pull request titled `demo: steps 13-33`, Claude Code prepares four things: `docs/guides/demo.md`, a script by role for weeks 1, 9 and 18; `e2e/demo.spec.ts`, the core-loop journey recorded with video on desktop and iPhone emulation, which Step 44 extends; the `v0.6-F` images, saved with `docker save` together with their checksums; and `docs/reviews/demo-33.md`, with the demo PDF (in the fallback font unless the license covers embedding) and the results of Step 41's Wi-Fi check and Step 26's phone check.
>
> **You:** start the saved images with `pnpm local:up --demo --seed 42 --week 9` and rehearse once. Then present with a real phone that trusts the exported root, in this order: sign-in; the term and framework; the SS01 import with its matched sections; publishing the plan and the generated tasks; a trainer's camera evidence and done; the head's review and a return; the readiness board; the portfolio and its PDF. Hand over `docs/ops/hosting-options.md` and the recording; `docs/ops/asvs.md` (Step 40) and the restore-drill result (Step 42) follow later. Use synthetic data and demo accounts only.

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

**Note from ADR-0008:** indicator mappings per task kind are added here (moved from Step 18), and the improvement-plan count joins with Step 38.

#### Step 35. Indicator screens (M)

**Goal:** each chart sits where its reader makes a decision.

**Do:** trainer indicators on Today and in the portfolio; section indicators on the section page; "Trainers and sections › Indicators" for heads; a college dashboard for the vice-dean; a summary for the dean. Every chart has a title that states the finding, a table toggle, CSV export and print styles.

**Done when:** every chart renders with demo data, axe passes, and visual snapshots exist.

#### Step 36. Pilot measurement (S)

**Goal:** the platform measures its own success.

**Do:** an event log (task opened, done, upload started, finished or failed, sign-in, review decision) with durations and no content; a "Pilot indicators" page for the admin and vice-dean that shows each success metric from section 1 against its threshold; an export for the report to the General Administration.

**Done when:** the metrics computed from the end-to-end runs match their expected values.

**Note from ADR-0008:** until a trial, the export is titled as demo data and end-to-end measurements. It lists sign-ins per task, the head's review time, week-2 return and the quality unit's answer as not measured.

> **Checkpoint: Audit 12.** Run `/audit 34-36`.
>
> **Checkpoint: Lead review G.** Run `/lead-review G`, then tag `v0.7-G`.

### Section H. Department collaboration: the secretary's part (steps 37 and 38)

#### Step 37. Meetings and minutes (M)

**Goal:** the secretary runs department meetings inside the platform.

**Do:** schedule a meeting; agenda and attendance; minutes in a rich-text editor (Tiptap, right to left); decisions and recommendations with owners and due dates that become tasks. The secretary drafts, the head approves and publishes, and meetings feed the department portfolio.

**Done when:** an end-to-end test covers a meeting from scheduling to published minutes, including a recommendation that becomes a task.

**Note from ADR-0008:** scheduling and reminders stay in-app, with no calendar invites: an isolated server sends no email, and Outlook and Teams wait for Microsoft 365.

**Note from Audit 3:** the secretary's keys for meetings go to the default role in `db/seed/base.ts` and, for colleges that exist already, in this step's migration (the note from Audit 3 under Step 10).

**Note from Step 13:** a membership can be limited to one term, and it grants its keys only while that term is active. `seed:demo` makes one Electrical trainer the department's secretary for the demo term.

#### Step 38. Improvement plans, documents and directory (S)

**Note from ADR-0008. You:** before this step, decide whether the department document library and the contact directory are built now or wait for the General Administration's Microsoft 365 decision. They overlap SharePoint and the college's Microsoft 365 directory, and no later step depends on them. Improvement plans are built either way. If the two wait, section 1's secretary row and `docs/BACKLOG.md` say so.

**Goal:** the department's shared work in one place.

**Do:** improvement plans created from recommendations; a versioned library of department documents; a contact directory built from people. Permissions follow the matrix.

**Done when:** an end-to-end test passes for each, and the permission-matrix test includes every new action.

> **Checkpoint: Lead review H.** Run `/lead-review H`, then tag `v0.8-H`.

### Section I. Production readiness on your laptop (steps 39, 40 and 42)

#### Step 39. Installed app and phone polish (M)

**Goal:** on a phone it feels like an installed app.

**Do:** web manifest and icons from the identity; install guidance for iPhone and Android; an offline shell; the upload queue kept in IndexedDB and resumed when the app reopens (document the iOS limits in `docs/ops/ios.md`); web push behind its setting; 44 px targets; layouts that hold at 200% text size; a check that every input uses the digit preprocessor from Step 4; and `pnpm local:share`, which opens a temporary HTTPS tunnel so a phone can reach the laptop (for example a Cloudflare quick tunnel, which needs no account), used with demo data only.

**Done when:** a Playwright test checks the manifest, a controlling service worker and the offline shell. **You:** through `pnpm local:share`, the manual checklist in `docs/ops/ios.md` passes on a real iPhone.

**Notes from ADR-0008**

- `pnpm local:share` comes from Step 41.
- No web push: it cannot work on an isolated server and waits for the hosting decision (docs/BACKLOG.md).
- The service worker wraps Step 25's IndexedDB queue. On option A, queued uploads are sent when the app is reopened on the college Wi-Fi.
- `docs/ops/ios.md` adds a run on Step 41's stack over the college Wi-Fi, with Caddy's root installed and fully trusted on the iPhone, and names Intune for distributing the root to staff phones.
- The real-iPhone check repeats Step 26's check on the installed app.

> **Checkpoint: Audit 13.** Run `/audit 37-39`.

#### Step 40. Performance and security hardening (M)

**Goal:** fast and safe under real use.

**Do**

- Performance: Lighthouse CI budgets on the key routes; an index review with `EXPLAIN`; checks for N+1 queries; caching for settings and catalogs only.
- Security: the nonce Content Security Policy verified; rate limits on sign-in, uploads and actions; the OWASP ASVS level 2 checklist; an OWASP ZAP baseline scan in CI; the permission matrix re-run; a dependency audit.

**Done when:** the budgets pass in CI, the ZAP baseline reports no high findings, and `docs/ops/asvs.md` is complete.

**Note from ADR-0008:** `docs/ops/asvs.md` marks the TLS, HSTS and network-exposure items "after the hosting decision". The dependency audit names option A's update path (a monthly image bundle on approved media, plus an urgent path for vulnerabilities) beside Renovate's automerge (ADR-0006). This step also verifies the account-plus-IP sign-in limits from Step 6.

**Note from Step 41:** the worker starts Chromium with `--no-sandbox` (`worker/print-check.ts`, then Step 32's renderer). Keep it, since Chromium prints only the platform's own pages from disk with no route out, or give the worker a seccomp profile that lets the sandbox run, and record the choice in `docs/ops/asvs.md`.

**Note from Step 12:** measured with Moto G4 emulation as the demo trainer, Today loaded 274,901 bytes of script in all before Step 12 and 279,435 after it, the bell's share; the stack loads when the bell is first reached for. Both are above the 250 KiB of ADR-0010's option B, before and after the load event together; Motion's feature bundle lands on either side of it.

**Note from Step 13:** measured the same way, Today loads 310,322 bytes of script in all. The announcements' dialog (ADR-0017) and the header's term switcher have joined the shell since Step 12.

**Note from ADR-0014:** two-factor is off by default (`auth.requireTwoFactor`). The ASVS level 2 checklist asks for multi-factor on administrative interfaces: record in `docs/ops/asvs.md` whether the pilot runs with the setting on, and if it stays off, the owner's reason.

**Note from Step 6:** the Content Security Policy keeps `style-src 'unsafe-inline'` because Motion and the image component set style attributes; verify that nothing else needs it. Better Auth accepts a TOTP code again within its window, and the sign-in limits trust the first `X-Forwarded-For` entry, which only Caddy in front makes the client's own (docs/BACKLOG.md).

**Notes from Audit 2**

- Section 4's script budget, 170 KB per route, is not met: after Audit 2 the login page loads 246.6 KiB of script and Today 248.0 KiB, while React and Next.js alone take about 145 KiB. ADR-0010 (proposed) asks the owner for a measured budget. `lighthouserc.json` warns at 170 KiB until then; this step makes the chosen budget an error, and tries to keep Motion's feature bundle off the routes that do not animate.
- The Lighthouse gate counts the best of three runs (`aggregationMethod: optimistic` in `lighthouserc.json`). Assert the median after a warm-up run, or record the choice in ADR-0001.

**Note from Step 7:** measured on the production build from a phone, the settings page loads about 304 KiB of script (Today 254 KiB): its BeUI controls with Motion's motion values, about 33 KiB, and Sonner, about 11 KiB. Zod stays off the client: `toLatinDigits` lives apart from the schema helpers in `src/platform/validation/digits.ts`. Decide whether the budget covers admin pages, or trim them here.

**Note from lead review B:** `readTable()` (`src/platform/files/table.ts`) hands a workbook's bytes to read-excel-file, which inflates every entry into memory: a 0.9 MB file whose sheet inflates to about 900 MB held 1.1 GB for 3.4 s before it was refused. With this step's upload checks, read the archive's declared sizes first, or read the sheet with a byte budget of about 20 MB; a 2,000-row people file needs under 1 MB (docs/reviews/lead-B.md, proposal 7).

> **Checkpoint: UX review 4.** Run `/ux-review 31-40` (portfolio, PDF, department file, indicators, meetings, documents, installed app).

#### Step 42. Logs, backups and a timed restore on your laptop (M)

**Goal:** problems are seen early, and data comes back within the targets, even on a laptop.

**Do:** structured logs with rotation; errors recorded in an `error_events` table, grouped by fingerprint, shown on the admin's system-health screen, with an in-app notification for a new error or an error rate above a setting (ADR-0005); continuous WAL archiving plus daily base backups (WAL-G or pgBackRest), run at the next start when the laptop was off, and restic for files, all encrypted, to a backup folder you choose outside the project (an external drive if you have one); a restore script; a runbook in `docs/ops/`. The admin gets an in-app notification when a backup fails.

**Done when:** a timed restore drill loses at most 1 minute of data and restores in at most 1 hour, a failed backup notifies the admin, and a forced error appears on the system-health screen and notifies the admin.

**Note from ADR-0008:** error and failed-backup alerts are in-app, as ADR-0005 sets out. The backup target is configuration: a folder or rotating external drives now (option A adds RAID1 on the server), or S3-compatible storage inside the Kingdom (option B). Keep the restore-drill result for the GA request as evidence for the data-owner question.

> **Checkpoint: Audit 14.** Run `/audit 40,42`.
>
> **Checkpoint: Lead review I.** Run `/lead-review I`, then tag `v0.9-I`.

### Section J. Demo data and full testing (steps 43 to 46)

**Note from Step 12:** the admin's notices of a new error, an error rate above its setting and a failed backup are notification kinds (the note under Step 22 says how), sent with `notify()` to each holder of the key that reads the system-health screen; a once key per error fingerprint and day keeps a repeated error to one notice.

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

**Note from lead review B:** at 2,000 people, `/people` took 581 ms one request at a time and sent 7.3 MB of HTML, and the trainer role's page 2.7 MB. With this step's larger seed, the people list and a role's members show the first hundred and search the rest on the server, and the log and the history panels name only the people on the page instead of reading the whole directory (`src/app/(app)/audit/lookups.ts`; docs/reviews/lead-B.md, proposal 5).

**Note from ADR-0008:** `--week` exists since Step 13; this step completes the data it drives. Demo data stays synthetic.

**Note from Step 13:** `seedDemoTerms()` (`db/seed/demo/terms.ts`) makes the active 18-week term and writes nothing once the college has a term; the closed previous term goes there.

**Note from Step 10:** the people exist since Step 10: `demoAccounts` names the ones the tests and guides use, and `demoCast()` draws the rest from the seed (`db/seed/demo/people.ts`). Whoever holds a key that requires two-factor gets it seeded, with the admin's authenticator secret and backup codes of their own (`DEMO_HEAD_BACKUP_CODES` in demo mode). Each account's password is hashed once per run, about 5 s of the seed's 2 minutes.

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

**Note from ADR-0008:** "modest hardware" means the minimum in `docs/ops/hosting-options.md`. Run k6 with the containers capped at 4 cores and 8 GB in total, so the result carries over to the QCT1250 or a cloud VM; Section K repeats the test on the chosen host. Wi-Fi capacity for about 40 phones uploading at once cannot be measured on the laptop, so it goes into the GA request.

> **Checkpoint: Audit 15.** Run `/audit 43-45`.

#### Step 46. Acceptance test with five trainers (M)

**Goal:** real people succeed without help.

**Do:** Claude Code prepares the session: five trainer accounts on the laptop's production-like stack (Step 41), a printed task card for each tester, a one-page guide per role in `docs/guides/`, and `docs/reviews/acceptance-46.md` for the results. **You:** run a moderated 30-minute session with five trainers, one of them over fifty, each on their own phone through `pnpm local:share`. Tasks: find this week's task, upload an exam copy by camera, mark it done, fix a returned task, open the portfolio PDF. Claude Code then fixes every P0 and P1 issue, and you repeat the session.

**Done when:** 4 of 5 finish without help within 10 minutes, and every success metric in section 1 that can be measured before launch meets its target.

**Note from ADR-0008:** the stack runs in demo mode (Step 41). Testers sign in to demo trainer accounts and photograph printed demo exam copies handed out with their task cards, never real papers or their own records, until the General Administration approves the data classification. `local:share` tests neither the college Wi-Fi nor an internal CA, so while option A is possible, add one run over the college Wi-Fi with the laptop's Caddy root trusted. The vice-dean's guide says that on option A, SS01, SF01 and SO01 are downloaded on an internet PC and brought in on approved media. Metrics that only a trial can measure stay open.

> **Checkpoint: Audit 16.** Run `/audit 46-46`.
>
> **Checkpoint: UX review 5.** Run `/ux-review 41-46`, the final consistency pass over every screen.
>
> **Checkpoint: Lead review J.** Run `/lead-review J`, then tag `v1.0-rc`.

### Section K. Going online, when you decide (steps 47 and 48)

> **Note (2026-10-20):** this section is written for Oracle Cloud, whose sign-up was refused. The General Administration chooses between a server inside the college and cloud hosting inside the Kingdom (section 8, open decisions; `docs/ops/hosting-options.md`), and this section is revised for that choice. Until then nothing here is built. This build stops after Step 46 and its checkpoints (ADR-0008): Audit 16 covers Step 46 alone, Lead review K runs only once this section is rewritten and built, and the go-live checklist in section 7 is revised with it.

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

**Do:** the logs and error tracking from Step 42 on the server; an external uptime check on both addresses; the Step 42 backups pointed at Oracle Object Storage in the same region through its S3-compatible API (20 GB free; the backup report shows usage); the restore drill and the Step 45 load test repeated on the server.

**Done when:** the restore drill on the server loses at most 1 minute of data and restores in at most 1 hour, the load test meets its targets there, and an alert fires when a backup fails.

> **Checkpoint: Audit 17, once this section is rewritten.** Run `/audit 47-48`.
>
> **Checkpoint: Lead review K.** Run `/lead-review K`, then tag `v1.1` and deploy it.

## 7. Final product-manager audit and the rebuild gate

After Step 46 and its checkpoints, run `/pm-audit`. The product-manager agent starts from a fresh context, judges outcomes rather than code, and writes `docs/reviews/pm-final.md`. Claude Code then acts on the verdict as this section describes.

**What the product manager checks**

1. **The teamwork closes.** One run of the whole loop with the demo people: the vice-dean opens the term and publishes the framework; the head publishes the plan and assignments; trainers deliver their work with evidence; the secretary publishes minutes; the head reviews the sample and approves portfolios; the dean reads the indicators and portfolios. Each row of "Who fills what" in section 1 is done by its own role, on its own screens, with no workaround.
2. **Every requirement is traced.** A table in the report links each requirement to a screen, a test and a result. It covers at least: the login page (at `https://localhost` now, and at the chosen host's address after Section K); nothing hardcoded; each role's part; the premium interface; demo data for courses, sections, trainers, the dean, the vice-dean, homework and tests; and a closed report for every checkpoint in `docs/reviews/`.
3. **Nothing hardcoded, proven.** `pnpm check:hardcode` passes, and every journey passes on the `alt` profile (Step 43), a different college built from data alone, with no code change.
4. **Numbers, not impressions.** Each success metric in section 1 is reported from the Pilot indicators page and the acceptance test. Four can only be measured in the trial: sign-ins per completed task, the head's weekly review time, trainers who return in week 2, and the quality unit's answer.
5. **Less is better.** Screens, settings and options that nobody used in the acceptance test, or that needed explaining, are listed for removal or merging.
6. **Ranked improvements** in three groups: before go-live, during the trial, and after approval. Each names whom it serves, which metric it moves, and its size.

**The gate**

| Verdict | When | Then |
| --- | --- | --- |
| Ship | Every metric that can be measured before launch meets its target, no P0 or P1 defect is open, and every requirement is traced | Tag `v1.0`. Once the General Administration has chosen the hosting, rewrite Section K for that option and run it, then the go-live checklist |
| Fix, then ship | Gaps remain, and no rebuild condition below applies | Add fix steps (46a, 46b and so on) in the same format, run their checkpoints on the same cadence, then run `/pm-audit` again |
| Rebuild a section | One section causes two or more missed metrics, or its core journey stays more than 50% over target after one round of fixes | Write an ADR in `docs/ADR/` on what failed and why; rebuild the section from its first step on a branch, with its tests as the specification; re-run every checkpoint from that section on |
| Rebuild the product | The core loop (task, evidence, done, review, portfolio) fails the acceptance test twice | Write an ADR; restart from Step 18 and keep Sections A to C if their reviews passed, or from Step 1 if the foundation is the cause; carry over the tests, the demo generator and the review reports |

A rebuild is part of the plan, not a failure of it. The bar is the best product for the people who use it, and the tests and reports make a second build faster than the first.

**During the trial.** Run `/pm-audit` again at week 4 and at the end of the term, with the Pilot indicators export in place of demo data. Its improvements become a new section of steps with the same checkpoints.

**Go-live checklist.** Confirm every item before the first real trainer signs in. It is revised with Section K for the chosen hosting (ADR-0008).

- The dean's written circular for the trial: its purpose, the three departments, the people, the data collected, and how long it is kept.
- Production runs in the Kingdom (Step 47), and a restore from last night's backup was timed this week (Step 48).
- The production database holds no demo data: no demo account exists, and `seed:demo` refuses to run there.
- Every admin uses two-factor sign-in, with "Require two-factor for admin keys" on in the security settings unless the owner chose otherwise in writing (ADR-0014), and `pnpm admin:create` refuses to run again.
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
| Microsoft Entra sign-in | Better Auth takes it as one more provider; the server and each phone must reach Microsoft's cloud, so it also waits for the hosting choice |
| SharePoint storage | every file goes through `StorageAdapter`; local disk is the first adapter; the server must reach Microsoft's cloud |
| Teams or Outlook notifications | notifications go through channels; in-app comes first, email and web push wait for the hosting decision, and Teams or Outlook need the server to reach Microsoft's cloud |
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
| Approval from the General Administration takes long | the written request (`docs/ops/hosting-options.md`: hosting, data classification, owners) goes out now; the GA demonstration after lead review F shows the core loop on demo data with a real phone; the Pilot indicators export (Step 36) and the restore drill (Step 42) follow |
| iPhone limits on installed web apps | uploads start at once and resume on the next open; no web push until the hosting decision, and none on an isolated server; limits recorded in `docs/ops/ios.md` |
| Personal data in Rayat files | only the minimal columns are kept, the raw file is discarded, data stays in the Kingdom, access follows scope, and every change is audited |
| The server fails in an exam week | continuous backups, a timed restore within 1 hour, a rehearsed rollback, and a restore drill before each exam week |
| Hosting is undecided: a server inside the college on an isolated network, or a cloud VM inside the Kingdom | Docker Compose runs either way; alerts stay in-app and nothing is fetched from the internet at runtime; Step 41 proves the stack offline, with an internal CA and images loaded from archives; Section K is rewritten for the choice (`docs/ops/hosting-options.md`, ADR-0008) |
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
| Where the platform runs for staff: a server inside the college (a Dell QCT1250 is bought but not yet delivered) or hosting in a cloud region inside the Kingdom; options in `docs/ops/hosting-options.md` | the General Administration, as part of the approval request | before Section K |
| Data classification, and the platform, data and technical owners | the General Administration, in the same request | before any real staff or trainee data is loaded; demo data stays synthetic until then |
| The three trial departments | the dean | go-live |
| One alert color outside the identity palette (red) | you | Step 23, where task states first appear |
| The department document library and contact directory, or Microsoft 365 for both | you | Step 38 |
| The college logo before sign-in | the dean, in writing | go-live; off until then |
| The font license covers web use and PDF embedding | the employer | go-live |

The term itself is not a build decision: the vice-dean for training enters each term, its start date, its number of weeks and its general framework in the platform (Step 13). Hosting while building is your laptop. Where the platform runs for staff is decided by the General Administration as part of the approval request: a server inside the college (a Dell QCT1250 was bought after the feasibility study of 14 October 2026 and has not arrived) or hosting in a cloud region inside the Kingdom (Oracle Cloud's sign-up was refused on 2026-10-20). `docs/ops/hosting-options.md` sets out both for that request. The platform runs in Docker Compose, so either works without code changes; Section K is revised for the chosen option.

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
