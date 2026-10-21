# Audit 3: steps 41, 7-9

- Range, in run order: Step 41 `fd5402c feat: production-like run on the laptop (step 41)` (PR #12), Step 7 `2940cd5 feat: settings screen, defaults and audit (step 07)` (PR #13), Step 8 `b3d13f2 feat: colleges and departments (step 08)` (PR #14), Step 9 `64a6b58 feat: roles, permissions and memberships (step 09)` (PR #16). Lead review A (`24b5911`) merged just before Step 41. I read the notes it left for these steps but did not audit it.
- Audited on `review/audit-09` at `64a6b58` (the same tree as `main`), 2026-10-21, by the auditor agent with the karpathy-guidelines skill.
- Verdict: **no blockers, 2 major, 9 minor.**
  - Steps 7, 8 and 9 meet their Done when, on desktop and on the iPhone.
  - 15 of 17 mutations make a unit or integration test fail. The two that pass every test remove the per-request caches.
  - Both majors are in Step 41:
    - Its smoke on the production images leaves out the journeys that the production-like run changes, yet PR #12 ticks "every journey".
    - The LAN address it hands to phones is probably wrong on the Windows laptop that the plan names, and nothing lets the owner correct it.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 72 s · `Checked 362 files in 378ms. No fixes applied.` · `Test Files  66 passed (66)` · `Tests  447 passed (447)` · `check:hardcode passed.` · `✔ no dependency violations found (323 modules, 1143 dependencies cruised)` |
| `pnpm check:unused` · `drizzle-kit generate` (on a scratch copy of HEAD) | knip exit 0 · `No schema changes, nothing to migrate` |
| On a throwaway database `audit09_e2e`: `db:migrate`, `db:seed`, then `seed:demo` twice | `seed:demo finished with --seed 42: college 01a15f07-…` both times. Rows afterwards: colleges 1, roles 7, role_permissions 11, departments 3, department_rayat_values 6, memberships 3, settings 4, users 3, audit_events 0 |
| `pnpm exec playwright test -c e2e/dev.local.config.ts settings.spec.ts departments.spec.ts roles.spec.ts --reporter=line --grep-invert @visual` (dev server on `audit09_e2e`) | `Running 46 tests using 2 workers` · `40 passed (2.6m)` · `6 skipped`. The skips are by design: the three desktop touch-target tests, and three tests that only one project runs (the Hijri switch and the stale session on the desktop, the college's short name on the phone) |
| The whole suite with the same config | `Running 200 tests using 2 workers` · `182 passed (5.9m)` · `18 skipped`, all by design. PR #16 reports the same counts on the standalone build |
| Statements per request on the dev server (`log_statement = 'all'` on `audit09_e2e`, one warm request each) | `/today` as the demo trainer: 6 statements, with 1 read of `settings` and 1 of `colleges`; lead review A counted 16. `/settings` as the demo admin: 7, with 2 reads of `settings` (minor 5). `/roles`: 9, with 1 and 1 |
| GitHub API | `fd5402c`, `2940cd5` and `b3d13f2`: all six checks succeeded, `Production stack` among them. `64a6b58` on `main`: `Production stack`, `check:all, build and smoke test`, `scan` and both `Analyze` jobs succeeded; `Docker images` was still running when I wrote this. PR #16's head `a8d2d6a` had all seven checks green. `GET /branches/main` → `"protected": false`, rulesets `[]`. Tag `v0.1-A` exists. No Renovate issue or branch |

**Probes.** The probes ran against a second throwaway database, `audit09_probe`, through the domain functions of a scratch copy of HEAD.

| Probe | Result |
| --- | --- |
| P1: two saves at once of a setting with no stored row, run unforced | `[{"to":40,"from":30},{"to":50,"from":40}]`: the first save had finished before the second began |
| P1b: the same, forced. A third session locks `audit_events`, so both saves read "no row" before either commits | `P1b events: [{"to":8,"from":7},{"to":9,"from":7}]` · stored `9`, version 2 |
| P2: department 2's short name is department 1's name; department 3's Rayat values are that same text and `elec-1` beside department 1's `ELEC-1` | `P2 statuses: created created created` |
| P3: a membership in a department that was set aside | `added` |
| P4: two page-order saves for two roles, each reading `navigation.order` before either writes, as `savePageOrderAction` does | `P4 orders kept: {"vice-dean":["today"]} expected both dean vice-dean` |
| P5: `lanAddress()` given adapter lists as Windows and WSL 2 report them | `windows, WSL switch listed first: 172.29.112.1` · `windows, Hyper-V default switch listed first: 172.22.48.1` · `inside WSL 2 (NAT), where Node sees only the virtual adapter: 172.31.40.7` |

**Mutation checks.** I applied each change to a scratch copy of HEAD made with `git archive`. Then I ran the named tests, restored the file from HEAD and checked its sha256. In that copy, `tests/unit/licensed-assets.test.ts` fails whatever the mutation, because the copy is not a git checkout. I left those two failures out.

| Mutation | Result |
| --- | --- |
| M1: `createDepartmentAction` without its permission | the matrix fails: "createDepartmentAction runs for exactly the roles that hold departments.manage across the college" |
| M2: `saveSettingAction` without `requirePermission` | 3 fail: both matrix rows of the action, and actions.test.ts "refuses a viewer without the setting's permission" |
| M3: `savePageOrderAction` without its permission | the matrix fails |
| M4: `authorize` reads a department's grant as college-wide | at least 11 fail, in authorize.test.ts, action-client.test.ts and the matrix |
| M5: `authorize` ignores the owner | "allows a record of one's own only to its owner" fails |
| M6: no setting asks for the password | 2 actions tests fail |
| M7: `ctx.requirePermission` drops the scope | "keeps a key held in one department to that department, for a check and for a list" fails |
| M8: `permittedDepartments` gives the college for any grant | 2 fail |
| I1: `setSetting` writes no `setting.update` | 2 integration tests fail |
| I2: `reauthenticate()` never asks | 2 fail |
| I3: the last admin can be removed | "… never the system role's last member, not even from themselves" fails |
| I4: the system role can be held in a department | 2 fail |
| I5: `loadAccess` makes every grant college-wide | access.test.ts "… each in its membership's scope …" fails |
| I6: the app's database role gets no rights in `pgboss` | app-role.test.ts "runs the worker's heartbeat" fails |
| I7: `updateDepartment` writes another action | "saves the changed fields, …, and records only what changed" fails |
| I8: `storedSettings` without React's `cache()` | **no test fails** (`Tests  2 failed \| 445 passed (447)`, the two being licensed-assets) |
| I9: `findCollege` without React's `cache()` | **no test fails** (the same counts) |

**Environment note.** Docker was not running in the container, so I started `dockerd` and the dev database. I did not run the stack smoke (`pnpm local:up --demo`), which is optional for this audit. CI ran it on every commit of the range.

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 41 | `https://localhost` shows the login page from the production images | proven by CI | `Production stack` succeeded on all four commits. auth.spec.ts "the login page names the platform …" runs in it |
| 41 | Every journey passes against it | **partly** | Major 1 |
| 41 | The stack comes back by itself after a restart | proven by CI | The job restarts Docker (`sudo systemctl restart docker`) and waits for `/readyz` through Caddy |
| 41 | (added) A CI job runs the smoke on the production images, failing any request outside the origin; Chromium prints an Arabic page on that network; the stack starts from saved archives | proven by CI | The `stack` job in ci.yml. The `ownOrigin` fixture in e2e/support/test.ts was active in my full run (182 passed). worker/print-check.ts. `verifyArchives` has unit tests |
| 41 | You: add the new check to the required checks | owner | `main` is still unprotected |
| 7 | A value changed on the screen is what `getSetting` returns on the next request (integration test) | proven | settings.test.ts "stores a value … which getSetting returns from then on" (I1). settings.spec.ts "a count saved on the screen is what the next request reads", on desktop and iPhone |
| 7 | Every setting has a description and an audit trail, and invalid values are rejected | proven | Labels and descriptions are typed message keys, and tests/unit/settings-catalog.test.ts checks them. Saves and resets write `setting.update` and `setting.reset` (I1). Seven kinds of invalid value are refused, and nothing is written |
| 8 | An admin creates three departments on the screen, their matching values are stored, and audit events exist | proven | departments.spec.ts:53, on desktop and iPhone. It reads the rows and the `department.create` events from the database |
| 9 | The matrix test passes, and fails when one check is removed from one action | proven | permission-matrix.test.ts passes 15 tests. M1, M2 and M3 each make it fail |
| 9 | Changing a role's permissions on the grid changes access at once (end-to-end test) | proven | roles.spec.ts:64, on desktop and iPhone |

**Plan rules.**

- **Hardcoded values.** `check:hardcode` passes. A search of `src/` for the seven seeded role keys finds none. Roles are found by `roles.system`, or by key in the seeds. `orderFor()` reads role keys as data, and every check goes through a permission key.
- **Server actions.** There are 11 checked actions and the 6 open sign-in actions. The matrix has 13 rows for the 11, because each settings action has a row per key a setting may name. All of them use next-safe-action with a Zod schema; `signOutAction` takes no input. Each checked action names its key in its metadata or calls `ctx.requirePermission`. The matrix lists all 17 (but see minor 8).
- **Audit events.** Every change the range adds writes its event in the same transaction: `setting.update` and `setting.reset` (page orders included, since they go through `setSetting`), `department.create` and `department.update`, `college.update`, `role.create` and `role.update`, and `membership.create` and `membership.delete`. A change that alters nothing writes nothing. `reauthenticate()` moves `sessions.password_entered_at` without an event; it is session bookkeeping, like `last_seen_at`. The seeds write no events.
- **Screen states.**
  - `/settings`: loading, the search's empty state, partial (a viewer sees only the settings whose key they hold), the shell's error page, and the refusal.
  - `/departments`: loading, the first-time empty state, partial (one of the two keys), error and refusal. Its form pages add not-found for an address that names no department of the college.
  - `/roles`: loading, error and refusal. Partial is the system role (all keys, no switches). A role with no member shows its empty line. Not-found as for departments.
  - All three are right to left, and the iPhone runs check 44 px targets and axe.
- **Demo data.** It holds four settings (Step 7), three departments with two Rayat values each (Step 8), and the three demo accounts' memberships (Step 9). Five of the seven roles have no member until Step 10 adds the demo people. A second run changes nothing.
- **Isolated network.** Every spec now fails on a request outside the platform's origin, and the whole suite passed with that guard on.

## Karpathy guidelines

1. **Think before coding: good, with two silent assumptions in Step 41.**
   - The PRs state their choices. PR #13 has "Choices made without blocking on the owner", and it leaves ADR-0007 with the owner, saying so. PR #12 lists what its sandbox could not prove.
   - Two choices were made silently:
     - `lanAddress()` assumes Linux adapter names on a plan that names Windows with WSL 2 (major 2).
     - PR #12 reads "every journey" as the journeys that need no database rows (major 1).
   - Step 9 dropped a plan instruction, seeding each role's page order, and said so in its PR body only (minor 7).
2. **Simplicity: proportionate, with weight where the owner put it.**
   - `scripts/local.ts` covers four commands, the env file, the archive checks and the LAN address in 322 lines.
   - The settings screen derives its controls from the Zod schemas in 58 lines (`controls.ts`), as "generated from the schemas" asks. The rest of the screen is per-row editing state, and each piece serves a stated behavior.
   - About 4,100 of the range's added lines are BeUI components and their local changes (switch, select, tabs, stepper, slider, action swap, table, breadcrumb, badge, combobox). The plan's notes ask for each one.
   - The plan asks for `ctx.departmentsFor()` and the `ownerId` scope, which have no caller yet. Nothing else is speculative.
3. **Surgical changes: good.**
   - Edits to earlier code serve the step:
     - the `@database` tag, which re-indents auth.spec.ts;
     - the grants in the tests' viewers;
     - the shared password-step words;
     - `latinDigits` moved so that Zod stays off the client;
     - the list field, toaster layout and form skeleton moved at their second use.
   - Each "Also in this PR" fix in Steps 7 and 41 was found by the step's own tests: the streaming race, `settled()`, the 44 px input, the menu press and the `tabIndex` pins.
   - knip is clean, and there is no formatting churn.
4. **Goal-driven: strong for Steps 7 to 9, weaker for Step 41.**
   - Every Done when of Steps 7, 8 and 9 has a test that ran green here, and 15 of 17 mutations fail a test.
   - Step 41's Done when rests on CI's stack job, which leaves out three journeys (major 1).
   - The per-request reads that Step 7 promises have no test at all (minor 5).

## Findings

### Blocker

None.

### Major

**1. The production-image smoke leaves out the journeys that the production-like run changes, while Step 41's "every journey passes against it" is ticked.**

- **What the plan asks.** Step 41's Done when (docs/PLAN.md:662) is "every journey passes against it", where every journey means "the journeys that exist at this point" (:670). At Step 41 those are Step 6's: sign-in, sign-out, the lockout, a remembered device, the admin's two-factor and the forced change.
- **What the smoke leaves out.** e2e/stack.config.ts:7 sets `SKIPPED = /@database|@visual/`, and these Step 6 tests carry `@database`:
  - the lockout (e2e/auth.spec.ts:117-119);
  - the remembered device (:151-153);
  - the two-factor setup of an admin who has none (:233-235);
  - axe on the code and password pages (:310-312).

  stack.smoke.ts brings back the sign-out and the forced change on the demo's invited trainer. The other three never run on the production images.
- **Why these three matter.**
  - The lockout's limits key on the address that Caddy writes into `X-Forwarded-For` (note from Step 6, docs/PLAN.md:678).
  - The remembered device's cookie (`__Secure-`, host-only, Secure) is the one cookie check that runs over Caddy's TLS.
  - The two-factor setup is the owner's own first run: `pnpm local:run admin:create`, then the temporary password, then the setup. Nothing exercises it on the production images. CI starts only the demo stack, and PR #12's manual check stopped at admin:create refusing a second run.
- **The claim.** PR #12 ticks the item with "44 passed, 1 skipped" on stand-in images.
- **Steps 8 and 9.** By the same tag, the journeys their own Done when names stay out of the stack too (departments.spec.ts:53, roles.spec.ts:64). The note at docs/PLAN.md:730 agrees to that.

Fix:
- (a) Run the lockout's first half on the stack against an employee number no account has: one answer for every wrong attempt, then the lock after five. It needs no database row. Keep the account half in the `@database` test.
- (b) Run the remembered-device check on the demo trainer instead of a made account.
- (c) In the stack job, also start the production-like stack (`pnpm local:up`), run `pnpm local:run admin:create`, and give a stack test the printed password. It takes it through the change and the two-factor setup to Today.
- (d) Optionally, add a screen-only variant of the three-departments journey.

Cost: about 1.5 h.

**2. On Windows and under WSL 2, the LAN address that `pnpm local:up` gives phones is probably a virtual adapter's, nothing lets the owner correct it, and docs/ops/local.md would read the failure as client isolation for the GA request.**

- **The platform.** Section 0 names the owner's platform: Docker Desktop "with the WSL 2 backend on Windows". docs/ops/local.md also lists Windows first.
- **The adapter filter.** `lanAddress()` (scripts/local.ts:87-101) skips only adapters whose names start with `docker`, `br-` or `veth`, and the test is case-sensitive (:90). Its unit tests use Linux names only.
- **Windows.** Windows reports its virtual switches as `vEthernet (WSL)` and `vEthernet (Default Switch)`, with private 172.x addresses. Probe P5 shows the function returning them whenever they come first in the operating system's order.
- **WSL 2.** Inside WSL 2 in its default NAT mode, Node sees only the VM's `eth0`, so the function cannot find the Wi-Fi address at all (P5).
- **No override.** `siteEnv()` (:202-210) always sets `SITE_ADDRESS` and `DEFAULT_SNI` in the process environment, which docker compose prefers to `docker/.env`. So the `SITE_ADDRESS` line in `docker/.env.example` is overridden every time.
- **The consequence.**
  - Caddy issues its certificate for the wrong address and serves it to a phone that sends no server name.
  - `pnpm local:up` prints an address the phone cannot reach.
  - docs/ops/local.md:57 then tells the owner that a page that does not open may mean client isolation, and to record that in the GA request. That is the "You" item at docs/PLAN.md:672.
- **What was not tested.** I could not run this on Windows. The adapter lists in P5 follow how Windows and WSL 2 report adapters.

Fix:
- Add a `--lan <address>` option to `pnpm local:up`. A key left empty in `docker/.env.example` would be filled with a random secret by `fillEnv`, so the override must not be an env key.
- Skip virtual adapters case-insensitively (`vEthernet`, `WSL`, `Hyper-V`, `VirtualBox`, `VMware`), and print the adapter that was chosen.
- Under WSL 2 (`/proc/version` names Microsoft), ask for `--lan`.
- In docs/ops/local.md, compare the printed address with the laptop's Wi-Fi address (`ipconfig`) before concluding anything about the network.
- Add Windows and WSL adapter lists to tests/unit/local.test.ts.

Cost: about 45 min.

### Minor

**1. Demo mode still publishes the demo admin's second factor, and every demo account shares one password.**
- **What Audit 2 asked.** Minor 10 asked for demo mode's secrets to be generated, because `pnpm local:share` puts that stack behind a public tunnel.
- **What was generated.** `DEMO_PASSWORD` and `DEMO_TOTP_SECRET` now are.
- **What stays published.**
  - The admin's backup codes are still `demo0-oasis` to `demo9-oasis` in staging too (db/seed/demo/accounts.ts:31-34 and :138).
  - docs/ops/local.md:69 tells the presenter to sign in with them.
  - All three demo accounts share `DEMO_PASSWORD` (accounts.ts:120).
- **The risk.** Anyone handed a demo trainer's password, such as Step 46's five testers, can sign in through the tunnel as the demo admin. They then hold every key. The data is synthetic.

Fix: in staging, derive the backup codes from `DEMO_TOTP_SECRET` (or generate them into `docker/.env`), and give the admin a password of its own. Let docs/ops/local.md say how the presenter gets a code. Cost: 30-45 min.

**2. Two settings writes at once are not serialized: a first save records the wrong "from", and two page-order saves lose one.**
- **The first save.** `setSetting` locks the setting's row with `for("update")` (src/modules/settings/server/set-setting.ts:44-51). With no row stored yet, that locks nothing. Under forced interleaving, both saves record the default as "from" (P1b: `{"from":7,"to":8}`, then `{"from":7,"to":9}`), and the history skips the 8. The comment at :44 says that two saves at once record each change once.
- **The page order.** `savePageOrderAction` reads `navigation.order` before the transaction that writes it (src/app/(app)/roles/actions.ts:150-156). Two admins ordering two roles' pages at once keep only one change (P4).

Fix: start `setSetting` and `resetSetting` with `pg_advisory_xact_lock` on the college and key, and read under it. Give `setSetting` an optional updater, `(current) => next`, so that the page order merges under the same lock. Add P1b as a test. Cost: 30 min.

**3. A department's name, short name and Rayat values are unique only within their own column, while Step 10's import matches all three.**
- **The check.** `findConflict` compares a new name with names, a short name with short names, and values with values (src/modules/org/server/departments.ts:105-136).
- **The probe.** P2 created a department whose name is a second one's short name and a third one's Rayat value. Values differing only in Latin case (`ELEC-1`, `elec-1`) are two values.
- **The consequence.** The note Step 8 wrote under Step 10 (docs/PLAN.md:825) matches an import row against name, short name and Rayat values, so one text can name three departments.

Fix: compare each new text with every other department's name, short name and Rayat values, case-folded for Latin, in one query under the existing college lock, and refuse a clash naming the other department. Cost: 30 min with tests.

**4. A membership can be given in a department that was set aside.**
- `addMembership` checks that the department belongs to the college, not that it is active (src/modules/access/server/roles.ts:334-345).
- Only the form filters inactive departments out (src/app/(app)/roles/[id]/members.tsx:216-217), so a direct call succeeds (P3). The note at docs/PLAN.md:781 offers only active departments.

Fix: add `eq(departments.active, true)` to the lookup, return an `inactive` status, and add a test. Cost: 15 min.

**5. Step 7's per-request reads have no test, and `/settings` reads the settings twice.**
- **What runs.** `storedSettings` and `findCollege` go through React's `cache()` (get-setting.ts:15, find-college.ts:7). At runtime this works: `/today` sends 6 statements where lead review A counted 16.
- **No test.** Removing either `cache()` passes all 447 tests (I8, I9). CLAUDE.md asks for a test that fails without each behavior change.
- **The double read.** The settings page calls `storedSettings(viewer.collegeId)` (src/app/(app)/settings/page.tsx:34), while `getSetting` calls `storedSettings(collegeId, db)` (get-setting.ts:55). That gives two cache keys, and `/settings` reads the table twice. find-college.ts:20 explains this exact trap.

Fix:
- Pass `db` to `storedSettings` only when a caller gives one, as `findCollegeId` does.
- Pin the behavior with a test: an end-to-end check of the statements one request to `/today` sends, or a unit test that both readers go through `cache()`.

Cost: 30 min.

**6. New default keys reach only fresh databases.**
- **The seed.** `seedBase` gives a default role its keys only when it creates the role (db/seed/base.ts:79-91). This is so a re-run never undoes the grid, and the stack's `migrate` service re-runs it at every start to no effect.
- **The note.** The note Step 9 left under Step 10 (docs/PLAN.md:830) gives the head role `accounts.resetPassword` "on the grid's default". The secretary's and quality reviewer's keys of Steps 33 and 37 work the same way.
- **The consequence.** These keys will reach CI and fresh demo stacks, but not a production-like stack that is already running.

Fix: in the notes under Steps 10, 33 and 37, add each new default key to existing colleges in a migration as well, for example `insert into role_permissions select id, 'accounts.resetPassword' from roles where key = 'head' on conflict do nothing`. Cost: 10 min of notes.

**7. Step 9 left the per-role page order unseeded, and only its PR body says so.**
- The note under Step 9 (docs/PLAN.md:766) asks for each role's page order in `navigation.order`.
- PR #16 explains that the registry's order serves every role today and seeds nothing. That is a sound choice, but neither CHANGELOG.md (its Step 09 entry) nor docs/PLAN.md records it.
- Audit 2's minor 5 flagged the same pattern.

Fix: one line in the CHANGELOG, and a note where a role first needs its own order. Cost: 5 min.

**8. The permission matrix finds actions by file name.**
- tests/unit/permission-matrix.test.ts:62 globs `src/app/**/actions.ts`.
- An action in a file named otherwise, or under `src/modules`, would escape "has every action of every action module". Yet the note under Step 13 (docs/PLAN.md:928) promises that the matrix "fails until it has one".

Fix: add a test that every file under `src/` with a `"use server"` directive is an `actions.ts` under `src/app`, or glob those files instead. Cost: 15 min.

**9. e2e/roles.spec.ts hardcodes the trainer role's seeded label.**
- `"المدرب"` appears at :177, :200, :220 and :222, where the spec could read `defaultRoles` from db/seed/base.ts, as it already reads `demoAccounts`.
- Step 44 runs every journey nightly on Step 43's `alt` profile, which seeds other roles "from data alone".

Fix: import the label. Cost: 5 min.

## Enhancements (at most 3)

1. **Tenant-safe foreign keys for departments.**
   - Give `departments` a unique `(college_id, id)`, and point `department_rayat_values (college_id, department_id)` and `memberships (college_id, department_id)` at it.
   - Benefit: no row can reference another college's department, whatever a later query forgets. Section 8's "every tenant row carries `college_id`" then holds by construction.
   - Cost: one migration and an integration test, about 30 min.
2. **Sign the image archives.**
   - Option A's updates arrive on approved media with `SHA256SUMS` beside them. A checksum on the same medium proves that the copy is whole, not that it came from the owner.
   - Benefit: a detached signature (minisign, or `cosign sign-blob` with a key the owner keeps), checked by `pnpm local:up --images`, gives an isolated server authenticity without a registry.
   - Cost: about 1 h, plus keeping the key; Step 40's dependency audit could own it.
3. **A per-setting re-authentication flag.**
   - `needsPassword()` derives "sensitive" from the `security` group (src/modules/settings/domain/registry.ts). A sensitive setting registered in another group would change without the password, for example Step 11's audit-log retention, which decides how long history is kept.
   - Benefit: a `reauth: true` flag beside `permission` makes the choice explicit for each setting.
   - Cost: 10 min, plus the actions test.

## Owner items still open

- Protect `main`, then add the `Production stack` check to the required checks (Step 41's "You"). Today: `"protected": false`, rulesets `[]`.
- The phone test on the college Wi-Fi (Step 41's "You", after the merge). On Windows, do it after major 2's fix, or check that the address `pnpm local:up` prints is the laptop's own.
- ADR-0007 is still "proposed". Step 7 built on the per-request read, which keeps nothing across requests, and left the choice open.
- ADR-0010 is due before Step 40, and lead review A's proposals wait in docs/BACKLOG.md.
- Install Renovate: there is still no Dependency Dashboard issue and no `renovate/*` branch.

## How this audit left the environment

- **Databases.**
  - The dev database `college` is unchanged. Before and after: migrations 8, colleges 1, roles 7, departments 3, memberships 3, settings 4, audit_events 1394.
  - The runs used `audit09_e2e` and `audit09_probe`, which I created and then dropped.
  - Statement logging was set on `audit09_e2e` only, and reset before the drop.
- **Servers.** I stopped the dev server I started for the statement counts, and Playwright stopped its own.
- **Files.**
  - The end-to-end runs rewrote the gitignored `.local/e2e/admin.json` and `trainer.json`, as every run's setup project does, and touched `test-results/` and `.next/dev`.
  - The scratch copy of HEAD, the probes and the logs live in the session's scratchpad.
- **Repository.** Nothing changed except this report.

## Resolution (review/audit-09)

- Branch `review/audit-09` from `main` at `64a6b58`, 2026-10-21. The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor finding gets a disposition here.
- The fixes found one more problem, outside the audit. Vitest 5 keeps transformed modules on disk between runs (`node_modules/.vitest-cache`), and a kept module keeps the files its `import.meta.glob` found in that earlier run. So on a laptop the permission matrix missed an action file added after a run, and a mutation check against it passed when it should have failed. CI starts without the cache, so CI was never fooled. `vitest.config.mts` now turns the cache off; a unit run takes 12.1 s, against 11.2 s with a warm cache.
- Commits are named by title. The squash-merge to `main` is titled `audit: steps 41,7-9`.
- `seed:demo` changes for minor 1 only: in staging, the demo admin's password and backup codes come from `docker/.env`. On a laptop (`APP_ENV=local`) the published values stay as they were, so an existing dev database needs nothing. An existing demo stack keeps its admin until its data is emptied (docs/ops/local.md).

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: the stack leaves out the journeys it changes | **Fixed (a, b, c); (d) not done.** (a) New test "an employee number no account has gets the wrong-password answer, and the lock after five attempts" runs on the stack with no tag; the account half stays `@database` ("five wrong passwords lock the account, and the right one then gets the lock too"). (b) The remembered-device test signs in the demo trainer, with no tag. (c) A new CI step in the stack job, "The first admin's first run on the production-like stack": `pnpm local:down`, then `pnpm local:up --images` from the same archives, then `pnpm local:run admin:create`. It masks the printed password and runs `e2e/first-run.config.ts` (one desktop project, no retry): the temporary password, the change, the two-factor setup, Today. On a failure the job prints both projects' logs and keeps both trace folders. (d) The three-departments journey stays `@database`; its screens (the refusal, axe and the 44 px targets) already run on the stack. | `test(stack): the lockout, the remembered device and the first admin on the production images` |
| Major 2: the LAN address on Windows and WSL 2 | **Fixed.** `lanAddress()` skips virtual adapters in any case of their names (`vEthernet`, WSL, Hyper-V, VirtualBox, VMware, libvirt, a Mac's bridges) and returns the adapter it chose. `LAN_ADDRESS` in `docker/.env` is `auto` (the default), `none`, or an address written by hand; under WSL 2, `auto` finds nothing and says to write it. It is a value with a default, so `fillEnv` never fills it with a secret. `pnpm local:up` prints which address it took and from which adapter. docs/ops/local.md compares that address with `ipconfig` or the Mac's Wi-Fi details before anything is concluded about client isolation. Unit tests cover Windows adapter lists, a wired adapter, and each `LAN_ADDRESS` case. | `fix(local): the Wi-Fi address on Windows and WSL 2, and the demo admin's own secrets` |
| Minor 1: demo mode publishes the admin's second factor | **Fixed.** `pnpm local:up` generates `DEMO_ADMIN_PASSWORD` and ten `DEMO_BACKUP_CODES` into `docker/.env`. `parseDemoEnv` requires them in staging, and the seed uses them. docs/ops/local.md gives the trainers' password to testers and keeps the admin's for the presenter. Tests: "writes demo secrets that a demo in staging accepts" (`tests/unit/local.test.ts`), and the staging seed test checks the admin's own password and its codes. | same commit |
| Minor 2: two settings writes at once | **Fixed.** `setSetting` and `resetSetting` take `pg_advisory_xact_lock` on the college and key before they read. `setSetting` also takes a function of the value in force, which the page order uses to merge one role's order into the others'. Three integration tests hold the first change open (its audit insert waits on a table lock) until the second waits on the database too: P1b, two roles' orders, and a reset beside a save. | `fix(settings): one change to a setting at a time, and page orders merge under the lock` |
| Minor 3: department texts unique per column only | **Fixed.** `findConflict` reads the other departments' names, short names and values in one query under the college lock and compares them through `foldCase()` (`src/platform/validation/text.ts`). A refusal names the other department, and the form's three messages say so. The notes under Steps 10 and 16 match imports the same way. | `fix(org): one department per text, no member in a department set aside, tenant-safe keys` |
| Minor 4: a membership in a department set aside | **Fixed.** `addMembership` returns `inactive`, and the members card shows its message. | same commit |
| Minor 5: per-request reads untested; `/settings` read twice | **Fixed.** `getSetting` passes a database to `storedSettings` only when its caller gave one, as `findCollegeId` does. `tests/unit/request-reads.test.ts` stands in for React's `cache()`, keyed on its arguments as React keys them, and counts the database's reads. | `test: pin the per-request reads and every server action; the trainer role from the seed` |
| Minor 6: new default keys reach fresh databases only | **Notes under Steps 10, 33 and 37**, with the `insert … on conflict do nothing` statement for the step's migration. | `docs: audit 3 report and resolution, plan notes, backlog and changelog` |
| Minor 7: the page order left unseeded, said only in a PR | **A CHANGELOG line and a note under Step 23**, where a role's home may first need its own order. | same commit |
| Minor 8: the matrix finds actions by file name | **Fixed**, together with the Vitest cache above. New test: "reaches every server action: each file that says "use server" is an action module under src/app". | `test: pin the per-request reads …` |
| Minor 9: the trainer role's label in roles.spec | **Fixed.** The spec reads it from `defaultRoles`. | same commit |
| Enhancement 1: tenant-safe keys | **Applied.** Migration `0008` adds `unique (college_id, id)` on `departments`, then points `department_rayat_values` and `memberships` at it. drizzle-kit wrote the two foreign keys before the unique key, which PostgreSQL refuses, so the SQL was reordered by hand; `pnpm db:generate` still reports no changes. Two integration tests insert a row naming one college and another college's department. | `fix(org): …` |
| Enhancement 2: signed archives | **docs/BACKLOG.md**, for Step 40 or the next lead review. | `docs: …` |
| Enhancement 3: a per-setting re-authentication flag | **Note under Step 11.** No setting outside the `security` group needs it until retention arrives there, so the flag waits for that step. | `docs: …` |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 366 files … No fixes applied.` · `Test Files  67 passed (67)` · `Tests  462 passed (462)` · `check:hardcode passed.` · `✔ no dependency violations found (323 modules, 1144 dependencies cruised)` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| CI-style end-to-end run: `pnpm build`, the static files copied into `.next/standalone`, `CI=1 pnpm exec playwright test` with `--grep-invert @visual` (the config only points at the container's Chromium) | `184 passed (3.3m)` · `18 skipped`, all by design |
| The stack's smoke, `e2e/stack.config.ts`, on a demo stack started by `pnpm local:up --demo --images` from a saved archive with its `SHA256SUMS` (stand-in images: this build over an earlier image's runtime; the worker without Chromium) | `78 passed (1.3m)` · `5 skipped`. The new lockout and remembered-device tests ran on the desktop and the phone through Caddy. The demo admin signed in with its own `DEMO_ADMIN_PASSWORD`. |
| CI's new step by hand: `pnpm local:down`, `pnpm local:up --images`, `pnpm local:run admin:create`, the password read with the step's `sed`, then `e2e/first-run.config.ts` | `1 passed (6.5s)` on the production-like stack (`APP_ENV=production`) |

**Mutation checks.** I applied each change, ran only the named tests, then restored the file.

| Mutation | Result |
| --- | --- |
| Both settings writes without the advisory lock | the three new settings tests fail |
| `findConflict` as it was | three department tests fail, the new cross-column one among them |
| `addMembership` without the active check | "gives no role in a department that was set aside" fails |
| `getSetting` passes its default database again | "reads the college's settings once …" fails |
| `storedSettings` without `cache()` | the same test fails |
| `findCollege` without `cache()` | "reads the college once …" fails |
| A `"use server"` file under `src/modules` | "reaches every server action …" fails (with the module cache on, it passed: the extra finding above) |
| A new `actions.ts` under `src/app` | "has every action of every action module …" fails |
| No generator for `DEMO_BACKUP_CODES` | two `local.test.ts` tests fail, "writes demo secrets that a demo in staging accepts" among them |
| Migration `0008` left out | the two cross-college insert tests fail |

### Known limits

- The stand-in images are this build copied over an earlier image's runtime, and the stand-in worker has no Chromium; CI builds the real images. The worker's print check ran only in CI.
- `foldCase()` folds letter case only. Two Arabic spellings of one department, such as with and without the article, are still two texts; an import row that matches none of them is a row error that points to the departments screen (the note under Step 16).
- The page-order merge keeps another role's order saved at the same time, but two admins ordering the same role's pages at once still keep the later order, as with any setting.

### Hand-off

- **docs/PLAN.md:** notes from Audit 3 under Steps 10 (two), 11, 16, 23, 33 and 37.
- **docs/BACKLOG.md:** signed image archives.
- **CHANGELOG.md:** the Audit 3 entry.
- **Owner:** the items in "Owner items still open" above stand. On Windows, run the phone test after this merge and compare the printed address first.
