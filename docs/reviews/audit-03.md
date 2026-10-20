# Audit 1: steps 1-3

- Range: Step 1 `650525d chore: repository and guardrails (step 01)`, Step 2 `106b1c5 feat: CI, containers and environment (step 02)` (PR #1), Step 3 `1536ceb feat: database, jobs and platform core (step 03)` (PR #2)
- Audited on `main` at `1536ceb`, 2026-10-20, by the auditor agent with the karpathy-guidelines skill
- Verdict: **no blockers, 4 major, 8 minor.** Every "Done when" item is proven, and the tests fail when the change under test is removed. The major findings are about guardrails: one is not switched on, two have gaps, and one plan deviation has no ADR.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | `Checked 68 files in 180ms. No fixes applied.` · `Test Files  18 passed (18)` · `Tests  54 passed (54)` · `check:hardcode passed.` · `✔ no dependency violations found (53 modules, 86 dependencies cruised)` |
| `pnpm exec playwright test` (throwaway config in the scratchpad that points at `/opt/pw-browsers/chromium`; nothing written to the repo) | `6 passed (20.3s)`: `health.spec.ts` ×2 and `placeholder.spec.ts` on `desktop` and `iphone` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| `db:migrate && db:seed && seed:demo`, run twice | colleges `1`, settings `0`, audit_events `0`, `drizzle.__drizzle_migrations` `1`, `pgboss.version` `46`; the same college id both times |
| `APP_ENV=production pnpm seed:demo` · `pnpm seed:demo --seed 0x10` | `seed:demo refuses to run when APP_ENV=production` exit 1 · `--seed must be a whole number from 0 to 4294967295, got "0x10"` exit 1 |
| `node --env-file=.env.local worker/index.ts` for 135 s | `worker started` 15:24:21.678Z; `heartbeat` 15:24:27.682Z, 15:25:27.696Z, 15:26:27.703Z; `worker stopped` on SIGTERM |
| `pnpm dev`, then `compose.dev.yml stop postgres` | `/` 200 `<html lang="ar" dir="rtl">` with `x-request-id`; `/readyz` 200 → `503 {"ok":false,"checks":{"database":false,"queue":false}}` in 0.028 s (logged `"msg":"not ready"` with `requestId`) → 200 after `start`; `/healthz` 200 throughout |
| GitHub API | CI on `main` 1536ceb: `check:all, build and smoke test`, `Docker images`, `scan`, both `Analyze` jobs all success. The deliberate type error in run 39423362842 (fbde662) failed at `Run pnpm check:all` |

**Mutation checks.** I applied each change to a scratch copy of HEAD, ran only the affected tests, then restored the file. Every mutation made its test fail:

| Mutation | Failing tests |
| --- | --- |
| `seedBase` without `where not exists` | db-setup "twice leaves the database unchanged", seed-base "one college when several runs start at once" |
| `getSetting` always returns the default | settings "returns the stored value", "throws … fails the schema" |
| seed:demo without the production guard | seed-demo "refuses to run when APP_ENV is production or unset" |
| `checkReadiness` always `ok: true` | 3 readiness tests (unit and integration) |
| proxy keeps the client's `x-request-id` | proxy "replaces an id the client sent" |
| demo seed always updates the college | seed-demo "a second run changes no row" |
| heartbeat cron `*/2 * * * *` | worker "schedules the heartbeat every minute", "runs one heartbeat a minute" |
| shutdown without the stop-once guard | worker-shutdown "stops once and exits 0" |
| request logger without `requestId` | request-logger "binds the request id" |

Environment note: the Docker daemon was not running in the container, so I started `dockerd` to run the Testcontainers suite.

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `pnpm check:all` passes on the placeholder page | proven | check:all above |
| 1 | An Arabic word in `src/` makes `check:hardcode` fail | proven | `tests/unit/check-hardcode.test.ts:31`; probe `src/app/page.tsx:1  arabic-text …  check:hardcode failed with 1 finding(s).` exit 1 |
| 1 | Five commands and the skill exist | proven | The five agents, the five commands and `CLAUDE.md` match `docs/PLAN.md` section 5 byte for byte (scripted diff); `docs/PLAN.md` is unchanged since Step 1 |
| 2 | A PR shows every check green, and a deliberate type error fails CI | proven | PR #1 head dde883b green; fbde662 failed at `pnpm check:all` |
| 2 | `compose.dev.yml up -d` then `pnpm dev` serves the placeholder | proven | `/` 200, rtl |
| 2 | App image under 300 MB, worker image builds | proven by CI only | The "App image is under 300 MB" and "Build worker" steps succeeded on main. Images cannot be built here because the Alpine mirror is blocked |
| 3 | migrate + seed twice leaves the database unchanged (test) | proven | `tests/integration/db-setup.test.ts:48`; mutation above |
| 3 | `getSetting` default then stored value (test); seed:demo twice without duplicates | proven | `tests/integration/settings.test.ts`, `tests/integration/seed-demo.test.ts:36`; manual run above |
| 3 | Heartbeat every minute; `/readyz` fails while PostgreSQL is stopped | proven | worker log and 503 above; `tests/integration/worker.test.ts:72`, `tests/integration/readiness.test.ts:40` |
| 3 | Integration tests run in CI | proven | `check:all` includes the `integration` Vitest project; `Run pnpm check:all` succeeded in runs 39446371010 and 39447439471. PR #2 still shows this box unticked (minor 6) |

**Plan rules not exercised in this range.** These steps add no server action, so `authorize()`, Zod input schemas and audit events are not yet testable. The only screen is the empty placeholder, so the five states do not apply yet. `check:hardcode` passes, and nothing checks a role or permission yet.

## Karpathy guidelines

1. **Think before coding: good in Steps 2 and 3, weaker in Step 1.** PR #2 states its deviation (a database per test file instead of a schema per file) and records it as ADR-0003. It also lists its known limits: the production stack cannot migrate yet, seed:demo writes no settings or audit rows, and settings are college-scoped only. Step 1 has no PR and made three choices silently: the public repository, `cacheComponents` and `partialPrefetching` (majors 4, minor 1).
2. **Simplicity: mostly proportionate.** The step code is small: about 430 lines for the database, seeds, worker, logging and health. Two places are heavier than needed: a test that monkeypatches `fs.write`, and a test of a pg-pool default (minor 5). `SMTP_URL` is configuration the plan does not ask for yet (minor 2).
3. **Surgical changes: good.** Every changed line traces to its step. When Step 3 changed Step 2's code, each edit served Step 3's goal: the image check now greps for `DATABASE_URL`, and `check:boundaries` also covers `worker` and `db`. No formatting churn. The one orphan is unused wiring: `createRandom` is passed into the demo seed but nothing reads it (minor 3).
4. **Goal-driven: strong.** Each Done-when item has a test, the type-error PR proves CI fails, and all nine mutations above make their tests fail.

## Findings

### Blocker

None.

### Major

**1. `main` is not protected, although PR #1 ticks the owner item "protect `main` with the required checks".**
Evidence: `GET /repos/Aziz93x/college-platform/branches/main` → `"protected": false`, `"required_status_checks": {"enforcement_level": "off", "contexts": []}`. `GET …/branches?protected=true` → `[]`. `GET …/rulesets` → `[]`. Step 2 "Do" (`docs/PLAN.md:499`) is not met, and a red PR can be merged.
Fix (owner, "You:"): add a ruleset or branch protection on `main`. Require these checks: `check:all, build and smoke test`, `Docker images`, `scan`, `Analyze (javascript-typescript)` and `Analyze (actions)`. Require no reviewers and block force pushes. Then confirm that `GET …/branches/main` returns `"protected": true`.

**2. The role-name rule in `check:hardcode` misses the common forms.**
`scripts/check-hardcode.mjs:20-22` catches only `role === "x"`, `roleKey === "x"` and `roles.includes("x")`. With these six lines in `src/app/roles.ts`, the script printed `check:hardcode passed.` and exited 0:
```
if (user.role.name === "dean") {}
if (actor.role.key !== "head") {}
switch (role) { case "trainer": break; }
if (["dean", "vice_dean"].includes(user.role)) {}
if (r.name === "admin") {}
const isHead = membership.roleId === HEAD_ROLE_ID;
```
Once roles become rows in Step 9, `role.key === "…"` is the most likely way to slip in a role-name check. The rule is the plan's only automated guard for "never by role name".
Fix: make the rule simpler and broader. Flag a line that mentions `role` (case-insensitive) and also has a string literal in a comparison, a `case`, or an `.includes(` on an array literal. Flag a `SCREAMING_CASE` constant whose name ends in `_ROLE` or `_ROLE_ID`. Add the six lines to `tests/unit/check-hardcode.test.ts`, the first five as must-fail. Cost: about 30 min.

**3. The "domain/ has no I/O" boundary allows I/O packages.**
`.dependency-cruiser.cjs:46-51` forbids `src/platform/`, `server/` and `ui/` (plus Node built-ins at :53-58). It does not forbid npm packages. A probe file `src/modules/probe/domain/y.ts` importing `pg`, `pg-boss`, `drizzle-orm` and `next/headers` gave `✔ no dependency violations found`. Step 3 added the first I/O packages without closing this gap.
Fix: turn the rule into an allowlist. From `^src/modules/([^/]+)/domain/`, allow only `^src/modules/$1/domain/` and `node_modules/zod`, and add pure libraries one by one when a step needs them. Prove it with a fixture test, as `check-hardcode.test.ts` does, that runs `depcruise` on a bad domain file. Cost: about 45 min.

**4. The repository is public, but the plan says private, and no ADR records the change. Step 4 will commit licensed fonts.**
Evidence: `GET /repos/Aziz93x/college-platform` → `"private": false, "visibility": "public"`. `docs/PLAN.md:454` says "Create the private repo". `docs/ADR/` holds only 0001-0003. The plan requires an ADR for "any decision that changes this plan" (`docs/PLAN.md:48`). Step 4 (`docs/PLAN.md:539`) writes the DIN Next LT Arabic font files into the repo. Those fonts are licensed through the owner's employer (`docs/PLAN.md:207`), and committing them to a public repo republishes them.
Fix (owner decision before Step 4): write ADR-0004 recording the public visibility and its reason. Branch protection and code scanning are free on public repos. If the repo stays public, Step 4 must keep the font files and any non-public brand assets out of git: gitignore them, fetch them in `identity:sync` and in the Docker build from the private identity repo with a token, and use the fallback font in CI. The alternative is to make the repo private, with the plan limits that brings for protection and CodeQL.

### Minor

**1. Undocumented framework flags.** `next.config.ts:5-6` turns on `cacheComponents` and `partialPrefetching` in Step 1. Step 1 asked for the React Compiler and Turbopack only, and neither the commit, `CHANGELOG.md` nor ADR-0001 mentions these flags. They already shape code: `await connection()` in `src/app/healthz/route.ts:5` and `src/app/readyz/route.ts:7`. Fix: add one line with the reason to ADR-0001, or remove both flags and the `connection()` calls.

**2. `SMTP_URL` is required before anything sends mail.** `src/platform/config/env.ts:12` requires it, so the production stack, `db:migrate` and `db:seed` refuse to start without an SMTP server. The plan's SMTP adapter arrives in Step 12 and is "off by default" (`docs/PLAN.md:664`). Fix: remove `SMTP_URL` from the schema, `.env.example`, `docker/.env.example`, `docker/compose.yml:22`, `.github/workflows/ci.yml:35` and `tests/integration/support/database.ts:55`. Step 12 adds it back as optional. Keep Mailpit in `compose.dev.yml`, which the plan lists.

**3. The demo seed holds nothing for two of the three new tables.** After `seed:demo`, settings and audit_events both have 0 rows. `ctx.random` (`db/seed/demo.ts:41`) is never read, because `seedDemoCollege` destructures only `{ db }` (`db/seed/demo/college.ts:13`). So `--seed` changes nothing yet. Fix: store `locale.timeZone` for the demo college, so demo data exercises the stored-value path, and accept no audit rows until Step 7. Keep `--seed`, which the plan requires, but leave `random` out of `ctx` until a step uses it.

**4. Brittle or low-value tests.**
- `tests/integration/worker.test.ts:165-184` preloads a `data:` URL that monkeypatches `fs.write`. Its own comment says it times out if pino changes how it writes.
- `tests/integration/db-client.test.ts:12-24` sleeps 2.5 s to prove that pg-pool has no connect timeout, a setting that never shipped on `main`.

Fix: delete both. The signal tests at `:143-163` already prove a graceful stop.

**5. Five copies of the PostgreSQL image tag, some where Renovate cannot see them.** `postgres:18.6-alpine` appears in `tests/integration/global-setup.ts:16`, `tests/integration/readiness.test.ts:17`, `.github/workflows/ci.yml:22` and `docker/compose*.yml`. Renovate bumps only the YAML copies, so the tests will drift from the runtime. Fix: one exported constant in `tests/integration/support/urls.ts`, plus a Renovate `customManagers` regex for it.

**6. PR #2's checklist was left with the "Integration tests run in CI" box unticked after CI went green.** `/step` resumes from unchecked items, so a resumed session could redo the item. Fix: tick it and cite run 39447439471.

**7. The Renovate app looks uninstalled.** PR #1 ticks "You: install the Renovate GitHub App". About 3 h after `renovate.json` merged, there is no Dependency Dashboard issue (the issues list holds only #1 and #2) and no `renovate/*` branch (branches: `main`, `step/02-…`, `step/03-…`). Fix (owner): check github.com/apps/renovate and confirm that the onboarding or Dashboard issue appears.

**8. Color guard gaps to close in Step 4.**
- `src/styles/tokens.css:8-13` activates a dark theme through `prefers-color-scheme`, a scaffold leftover. The plan ships dark tokens but not the dark theme (`docs/PLAN.md:211`).
- The color rule catches only hex. `rgb()`, `hsl()`, `oklch()` and Tailwind's default palette (`text-red-600`) pass the probe, but CLAUDE.md says "no … colors in src/".

Fix in Step 4: generate dark tokens without the media query, extend the rule to functional color notations, and reset Tailwind's default palette in `@theme` with `--color-*: initial`.

## Enhancements (at most 3)

1. **Run the CI smoke test against the production build.** `playwright.config.ts:24` always starts `pnpm dev`, so CI builds the app and then tests the dev server instead.
   - Benefit: catches failures that happen only in the build, such as standalone file tracing missing `pg-boss` or `pino`, Cache Components prerender errors, or the instrumentation exit.
   - Cost: about 30 min. When `CI` is set, use `command: "node .next/standalone/server.js"` and copy `.next/static` after `pnpm build`.
2. **Enforce append-only `audit_events` in the database.** A migration with a trigger that raises on `UPDATE` or `DELETE`, plus one integration test.
   - Benefit: principle 4 ("history is append-only") holds even against a bug or a manual query, before Step 7 starts writing events.
   - Cost: about 45 min.
3. **Add a one-shot `migrate` service to `docker/compose.yml`.** Copy `db/` into the worker image and run `node db/migrate.ts` before `app` and `worker` start (`depends_on: condition: service_completed_successfully`).
   - Benefit: the production-like stack gets its tables now, so Step 2's promise that it "runs the same way" on the laptop and the server holds before Step 41. PR #2 lists this gap as a known limit.
   - Cost: about 1 h, and it overlaps Step 41. Put it in `docs/BACKLOG.md` unless Step 41 is close.

## Resolution (review/audit-03)

- Branch `review/audit-03` from `main` at `1536ceb`, 2026-10-20. The `/audit` command asks to fix every blocker and major, apply enhancements that stay in the plan and take under an hour, and backlog larger ones. Minor findings are not on that list. Each one gets a disposition here, and each deferred one goes where a later session reads it: a note under the affected step in `docs/PLAN.md`, which `/step` reads, or `docs/BACKLOG.md`, which `/audit` names as the hand-off to the next lead review.
- A second pass checked the first round of fixes. It found gaps in majors 2 and 4 and in the new rules; "Second pass" below lists them. The table shows the final state.
- Commits are named by title below. The PR lists their ids; the squash-merge to `main` is titled `audit: steps 1-3`.
- `seed:demo` is unchanged: guard rules, a trigger, CI wiring and docs add no data.

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: `main` is not protected | **Owner.** The GitHub tools in this session cannot write rulesets, so the PR carries the ruleset checklist below. `list_branches` on 2026-10-20, after the second pass: `main` `"protected": false`, so **pending owner**. | none |
| Major 2: the role rule misses common forms | **Fixed.** `role-name-comparison` is a short function in `scripts/check-hardcode.mjs`. On a line that mentions `role`, it flags a role-like string literal (one with no dot or slash) that is compared with `===` and the like, searched for with `.includes`, `.has`, `.startsWith` or `.endsWith`, passed to `hasRole()` or a Drizzle comparison (`eq`, `ne`, `inArray`, `notInArray`, `like`, `ilike`), listed in an assigned array, or compared in SQL (`= 'x'`, `<> 'x'`, `in ('x')`). It also flags an array or `Set` literal searched with `.includes(` or `.has(`, a `case "x"` in the innermost open `switch` whose discriminant mentions role (found by counting braces, so nested switches work), any `SCREAMING_CASE` name with a `ROLE` or `ROLES` part, and an `enum` named after roles. Permission keys such as `"roles.assign"`, message keys and paths hold a dot or a slash, so they pass. `tests/unit/check-hardcode.test.ts` has 27 must-fail lines, and 15 must-pass lines plus three `case` lines under a `switch` on something else. | `fix(guardrails): catch role-name checks in their common forms` |
| Major 3: `domain/` allows I/O packages | **Fixed.** `domain-has-no-io` in `.dependency-cruiser.cjs` is an allowlist. From `^src/modules/([^/]+)/domain/`, tests included, it allows only `^src/modules/$1/domain/`, `zod`, `vitest` and a module's `index.ts`. A second rule, `domain-imports-only-types-from-modules`, lets `domain/` take only type-only imports from an `index.ts`, because an `index.ts` also exports server code. Together they replace `domain-has-no-node-builtins`. The new `tests/unit/check-boundaries.test.ts` runs `depcruise` on a fixture. | `fix(guardrails): allow only zod and the module's own domain files in domain/` |
| Major 4: public repository, no ADR | **ADR-0004, status proposed. The owner confirms it before Step 4, and the guard holds either way.** The repository stays public, because on GitHub Free a private one gets no branch protection, rulesets or CodeQL code scanning, which Step 2 needs. Licensed or non-public brand assets never enter git. `.gitignore` ignores `*.woff`, `*.woff2`, `*.ttf`, `*.otf` and `/public/brand/`. `tests/unit/licensed-assets.test.ts` fails when those entries are removed or such a file is tracked anyway. `docs/PLAN.md` Step 4 carries a note that points to ADR-0004. The fix proposed above, "use the fallback font in CI", does not work: `next/font/local` reads every font file at build time (`node_modules/next/dist/compiled/@next/font/dist/local/loader.js:20-21`), so a missing file fails `pnpm build`. CI and the Docker build must fetch the fonts before they build, and the ADR and the Step 4 note now say so. | `docs(adr): record the public repository and keep licensed assets out of git`; `chore(guardrails): keep licensed fonts and brand assets out of git` |
| Enhancement 1: CI smoke test on the production build | **Applied.** With `CI` set, `playwright.config.ts` starts `node .next/standalone/server.js` (`PORT`, and `HOSTNAME=localhost` because runners set `HOSTNAME` to the machine name). `ci.yml` copies `.next/static` into the standalone output after `pnpm build` and sets `DEBUG=pw:webserver` on the e2e step, so the log names the server command. | `ci: smoke-test the standalone production build` |
| Enhancement 2: append-only `audit_events` | **Applied.** Migration `0001_audit_events_append_only.sql` adds one plpgsql function and two triggers that reject `UPDATE`, `DELETE` and `TRUNCATE`. The new `tests/integration/audit-events.test.ts` covers them. `tests/integration/db-setup.test.ts` now expects one `drizzle.__drizzle_migrations` row per journal entry instead of exactly one. The migration header and `CHANGELOG.md` say what the triggers do not stop (see Known limits). | `feat(audit): reject updates and deletes of audit events in the database` |
| Enhancement 3: one-shot `migrate` service in compose | **docs/BACKLOG.md** (about 1 h, overlaps Step 41). | `docs: backlog the compose migrate service` |
| Minors 1-5 | **docs/BACKLOG.md**, section "For lead review A", one line each. | `docs: hand deferred audit items to the plan and the backlog` |
| Minor 6: PR #2 box unticked | **Done.** PR #2's "Integration tests run in CI" box is ticked and cites run 39447439471 (CI on `main` at 1536ceb, success). A diff of the body before and after shows only that line changed. | none (GitHub edit) |
| Minor 7: Renovate app looks uninstalled | **Owner** (checklist below). | none |
| Minor 8: color guard gaps | **docs/PLAN.md**, note under Step 4, together with the `public/` copy for the standalone build. | `docs: hand deferred audit items to the plan and the backlog` |

### Second pass

A review of the first round of fixes found these gaps. All of them are fixed except the two false positives kept under Known limits.

| Finding | Fix |
| --- | --- |
| Major 4 was guarded only in prose. Nothing was gitignored, and `/step` reads only `CLAUDE.md` and `docs/PLAN.md`, whose Step 4 still told `identity:sync` to write the font files | `.gitignore` entries, `tests/unit/licensed-assets.test.ts`, and the note under Step 4. ADR-0004 says the entries already exist |
| The role rule missed Drizzle (`eq(roles.key, "head")`, `inArray(roles.key, [...])`), raw SQL (`where key = 'dean'`), `enum Role`, `ROLES = {...}`, `ADMIN_ROLES`, `ROLE_DEAN`, `ADMIN_ROLE_KEY`, `new Set([...]).has(...)` and `.startsWith("vice_")` | Rule widened as in the Major 2 row. Every listed line is in the must-fail list |
| A `case` after a nested `switch` was read against the inner `switch` | The innermost open `switch` is found by counting braces |
| The rule flagged permission-key checks such as `permissions.includes("roles.assign")`, and paths such as `"/admin/roles"` | Only role-like literals count. Two false positives remain (Known limits) |
| ADR-0004 said the app falls back to the fallback font when the font files are missing | Corrected: `next/font/local` needs the files at build time |
| `domain/` tests were exempt from the whole rule, so a test could import `pg` or `src/platform/` | Tests follow the rule and may also import `vitest` |
| `domain/` could not take another module's types, as it could on `main` | Type-only imports from an `index.ts` are allowed |
| The migration header said the database rejects any change "whatever the app or a manual query tries" | Corrected in the header, `CHANGELOG.md` and Known limits. A non-owner app user is in `docs/BACKLOG.md` |
| Items deferred to lead review A, to Step 4 and to Step 11 lived only in this report | Moved to `docs/BACKLOG.md` and to notes under Steps 4 and 11 in `docs/PLAN.md` |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 72 files in 52ms. No fixes applied.` · `Test Files  21 passed (21)` · `Tests  61 passed (61)` · `check:hardcode passed.` · `✔ no dependency violations found (53 modules, 86 dependencies cruised)` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm build`, `cp -r .next/static .next/standalone/.next/static`, `.env.local` exported, `CI=1 DEBUG=pw:webserver pnpm exec playwright test` (throwaway config that points at `/opt/pw-browsers/chromium`; deleted) | `pw:webserver Starting WebServer process node .next/standalone/server.js...` · `- Local:         http://localhost:3000` · `6 passed (2.7s)` |
| The same run without `CI` | `6 passed (8.7s)` on `pnpm dev` |
| The 16 lines from the second pass in a probe `src/probe.ts`, then `node scripts/check-hardcode.mjs <probe root>` | `src/probe.ts:1` to `:16  role-name-comparison` · `check:hardcode failed with 18 finding(s).` exit 1. The other 2 findings are the accepted false positives in the probe's `pass.tsx`. `eq(settings.key, key)`, `eq(memberships.roleId, input.roleId)`, `pathname === "/admin/roles"` and `permissions.includes("roles.assign")` passed |
| `git check-ignore -v --no-index public/fonts/DINNextLTArabic-Regular.woff2 src/styles/fonts/x.otf src/app/fonts/x.ttf x.woff public/brand/logo.svg` | each path is ignored, by `.gitignore:49-53` · `git ls-files '*.woff' '*.woff2' '*.ttf' '*.otf' public/brand` prints nothing |
| As the dev database's `DATABASE_URL` user (`rolsuper` `t`, owner of `audit_events`), in one transaction rolled back afterwards | a plain `update audit_events` → `ERROR:  audit_events is append-only: UPDATE is not allowed`. After `set local session_replication_role = replica`, the same update → `UPDATE 1`. After `alter table audit_events disable trigger audit_events_no_update_or_delete`, a delete → `DELETE 1`. After the rollback, the trigger is enabled again (`tgenabled` `O`) |

**Mutation checks.** I replaced each file with an earlier version, ran only the affected test, then restored it. The sha256 of each restored file matched its pre-mutation value.

| Mutation | Result |
| --- | --- |
| `scripts/check-hardcode.mjs` with the first-round rule | `Tests  2 failed \| 3 passed (5)`: "fails on role names compared in code" `expected [ …(11) ] to deeply equal [ …(27) ]`, and "passes permission checks and other uses of the word role" `expected [ …(2) ] to deeply equal []` |
| `scripts/check-hardcode.mjs` as in `1536ceb` | `Tests  1 failed \| 4 passed (5)` |
| `.dependency-cruiser.cjs` with the first-round rule (tests exempt, no `index.ts` types) | "lets domain/ import only zod and its own domain files" fails: `pg.test.ts` and `platform.test.ts` are not flagged, `types.ts` (a type-only import of another module's `index.ts`) is flagged, and `runtime.ts` is flagged by `domain-has-no-io` instead of `domain-imports-only-types-from-modules` |
| `.gitignore` as in `1536ceb` | "keeps font files and fetched brand assets out of git" fails: `Command failed: git check-ignore --no-index public/fonts/DINNextLTArabic-Regular.woff2 …` |
| `0001_audit_events_append_only.sql` and its journal entry removed (first round) | `Tests  3 failed \| 1 passed (4)`: `promise resolved "Result{ command: 'UPDATE', …(9) }" instead of rejecting`, and the same for `DELETE` and `TRUNCATE`; "stores a new audit event" passes |

### Known limits

- **The role rule reads one line at a time.** It misses a check whose line never mentions role, such as `if (r.name === "admin")`, or `ADMIN.has(key)` after `const ADMIN = new Set(["dean"])`. It also misses a role value copied into a variable first (`const key = user.role.key;` and later `key === "dean"`), a multi-line SQL string whose `where` line does not mention role, a role union type (`type RoleKey = "dean" | "head"`), and `role: z.enum(["dean", "head"])`. `case Role.Dean` is caught only through the `enum Role` declaration. Code review and the audits cover these forms. A check against the seeded role keys can come in Step 9 if it is needed.
- **Accepted false positives.** A line that mentions role and compares something else with a role-like literal is flagged, for example `members.filter((m) => m.status === "active" && m.roleId)` or `<div role="status" data-x={a === "b"}>`. Split such a line. A `SCREAMING_CASE` name with a `ROLE` or `ROLES` part is flagged even when it names a permission, as `MANAGE_ROLES` would. Use the permission key string, as `CLAUDE.md` asks.
- **The triggers stop mistakes, not the table owner.** They reject `UPDATE`, `DELETE` and `TRUNCATE` from ordinary queries. The app connects as the owner of `audit_events`: that is `POSTGRES_USER`, a superuser, in `docker/compose.yml`, CI and `.env.example`. Any query run as that user, manual or injected, can get past the triggers with `alter table … disable trigger` or `set session_replication_role = replica` (re-run results above). An app user that does not own the table would close this gap, and it is in `docs/BACKLOG.md`. Step 11's retention purge, and any backfill in a later migration, needs its own path past the triggers; the note under Step 11 says so. A row-level trigger does not fire for a statement that touches no rows, so `delete from audit_events` on an empty table succeeds. Nothing changes, so this is harmless.

### Hand-off

- **docs/PLAN.md, Step 4:** fonts and non-public brand assets are fetched by `identity:sync`, gitignored and fetched before `pnpm build` in CI and Docker (ADR-0004); minor 8; the `public/` copy in `ci.yml` and in the `app` stage of `docker/Dockerfile`.
- **docs/PLAN.md, Step 11:** the triggers and the retention purge.
- **docs/BACKLOG.md:** minors 1-5 for lead review A, the compose `migrate` service, and an app database user that does not own the tables.

### You: owner checklist

**Major 1: protect `main`** (github.com/Aziz93x/college-platform/settings/rules -> New ruleset -> New branch ruleset)
- [ ] Name it `main`, set Enforcement status to **Active**, and add the target **Include default branch**.
- [ ] Turn on **Restrict deletions** and **Block force pushes**.
- [ ] Turn on **Require a pull request before merging** with **Required approvals: 0** (one person builds it; no reviewers).
- [ ] Turn on **Require status checks to pass**, and add these five checks (source: GitHub Actions): `check:all, build and smoke test`, `Docker images`, `scan`, `Analyze (javascript-typescript)`, `Analyze (actions)`.
- [ ] Leave the bypass list empty, then save.
- [ ] Confirm that `GET /repos/Aziz93x/college-platform/branches/main` returns `"protected": true`.

**Major 4: repository visibility** (`docs/ADR/0004-public-repository.md`, status "proposed")
- [x] Confirmed on 2026-10-20 (the owner chose a public repository): the repository stays public and licensed or non-public brand assets never enter git. The ADR then moves to "accepted". Or choose the alternative (private, which needs a paid plan for branch protection, rulesets and CodeQL) and say so before Step 4.
- [ ] Check whether `Aziz93x/identity-design`, which GitHub reports as public, holds the DIN Next LT Arabic font files. If it does, they are already published there: decide whether to remove them from it (and its history) or make that repo private.
- [ ] If the identity repo becomes private, create a fine-grained read-only token for it and add it as an Actions secret before Step 4, so CI and the Docker build can fetch the fonts.

**Minor 7: Renovate**
- [ ] Check github.com/apps/renovate for this repository and confirm that the onboarding PR or the Dependency Dashboard issue appears.
