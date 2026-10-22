# Lead review B: production-like stack, organization, roles and settings (Step 41, then Steps 7 to 12)

- Section B in run order, from `git log --oneline` on `review/lead-B`:
  - Step 41 `fd5402c` (#12);
  - Steps 7, 8 and 9: `2940cd5` (#13), `b3d13f2` (#14), `64a6b58` (#16);
  - Audit 3 `6c1f243` (#18, docs/reviews/audit-09.md);
  - Steps 10, 11 and 12: `3372fdd` (#21), `8deb67c` (#22), `e0f9ac2` (#23);
  - ADR-0014 `40c61b3` (#24);
  - UX review 1: `980097f`, `cae92c8`, `2430cc6`, `f268dd7` (#25, docs/reviews/ux-10.md);
  - Audit 4: `ed49b7a`, `5f88c67`, `3e47c2d`, `755e6b6`, `c23d378`, `8f11d20`, `f1bb4b6` (#26, docs/reviews/audit-12.md).
- Reviewed on `review/lead-B` at `f1bb4b6`, 2026-10-22, by the lead-engineer agent. That tree is `main` at `40c61b3` plus #25 and #26, which are not merged yet and wait only on three `/design` visual baselines that CI writes. **I review this tree as the section's final state.**
- How I ran it:
  - On the standalone build, as CI runs it.
  - Two throwaway databases, both dropped at the end. `lead_b_e2e` served the suite, the timings, the statement counts, the journeys and the trace. `lead_b_lock` served the import lock, a college grown to 2,000 people and 301,387 events, and the reach probe.
- Verdict: **Section B works as a system on demo data, with 4 must-fix items (about 4 hours in all) before the `v0.2-B` tag.**
  - What holds:
    - `pnpm check:all` is green (597 tests), and the full end-to-end suite passes: `222 passed`, `24 skipped` by design, though 2 tests needed their retry.
    - All 27 server actions are in the permission matrix and in `actions-audit`, and every input has a bounded Zod schema.
    - Statements per page are fixed (2 to 24); none grows with the rows.
    - Reads meet section 4's budget one request at a time (p95 20 to 57 ms), and writes meet it at 20 concurrent (p95 459 ms or less).
    - A department renamed on its page reaches every screen, the log's CSV and the import.
  - What must be fixed:
    - The required two-factor setup lands on the profile in about 1 run in 6, a flaky test that CI's retry hides.
    - One switch on the roles grid lets a non-admin role take over the system admins.
    - A people import stalls every sign-in and audited change in the college for as long as it runs: 3.8 s for 40 people, about 3 minutes at its 2,000-row limit.
    - The indexes made for the log's and the notification center's pages are not used, so each first page sorts the whole table.

## Must-fix (before tagging `v0.2-B`)

Ordered as found: the failure first, then security, then availability and speed.

### M1. The required two-factor setup ends on the profile instead of Today in about 1 run in 6, and CI's retry hides its failing test

- **Evidence.**
  - The full suite, as CI runs it: `Running 248 tests using 2 workers` · `2 flaky` · `24 skipped` · `222 passed (4.6m)`.
    - One of the two is `[desktop] › e2e/auth.spec.ts:332:1 › while the college requires it, an admin without two-factor sets it up …`, with `Expected: "http://localhost:3000/today"` and `Received: "http://localhost:3000/profile"`. Its retry passed.
  - The test alone, on one worker, so nothing else touches the college's setting (`--repeat-each 12 --retries 0 --workers 1`): `2 failed` · `12 passed (1.3m)`. The 12 passed include the two setup tests, so 2 of the 12 runs failed.
  - The trace shows a race:
    1. `POST /two-factor/setup` answers `x-action-redirect: /today;push`, with the session's new cookie.
    2. The client then fetches `GET /two-factor/setup?_rsc=…` again.
    3. Two-factor is now on, so that page redirects to `/profile` (`src/app/(auth)/two-factor/setup/page.tsx:22-23`).
    4. That redirect lands after the action's own.
  - So ADR-0014 #6 ("to Today when the college required it of them") holds only when the action's answer wins. Two-factor is set up either way; only the page differs.
  - CI runs the suite with `retries: 1` (`playwright.config.ts:28`), so a CI run fails on this test about once in 36, and its other failures pass unseen on the retry. The production stack's smoke leaves the test out (`@database`).
- **Fix.**
  - Make the page agree with the action. Once two-factor is on and the college requires it of the viewer, `/two-factor/setup` redirects to `/today` (`viewer.twoFactorRequired`); otherwise to `/profile`. Whichever answer lands last then sends the person to the same place.
  - Tests:
    - A unit test of the page's choice: required and now on gives `/today`.
    - Before the merge, the end-to-end test passes `--repeat-each 20 --retries 0 --workers 1`.
- **Cost:** 30 min.
- **To watch, not must-fix.** `e2e/people.spec.ts:488` ("the account menu › leads to the profile, and to changing the password") failed once in the full run.
  - It expected `/profile/password` and stayed on `/profile`.
  - It passed on its retry and in 30 more runs: 10 beside the test above, and 20 alone on two workers.
  - Its trace has no request for `/profile/password` after the press on "تغيير كلمة المرور", so the press on the bloom menu's item was lost while the machine was busy. I could not reproduce it.

### M2. A key held across the college reaches the system admins: one switch on the grid lets a non-admin role take over every admin account

- **Evidence.**
  - `reachesAccount()` returns true for every account when the actor holds the key across the college (`src/modules/access/domain/reach.ts:21`).
    - The rule that keeps a head from "the dean, an admin or another head" applies to keys held in a department only.
    - The same reach gates the temporary password, turning off two-factor (ADR-0014 #3) and the employee number.
  - Probe on the production build (`lead_b_lock`, desktop): the seeded grid, plus one switch made by the admin on the screen.

    ```
    1. grid saved: vice-dean holds accounts.resetPassword across the college
    2. vice-dean issued a temporary password for the system admin: yes
    3. vice-dean turned off the system admin's two-factor
    4. signed in as the system admin without a code; /settings answers 200 الإعدادات · …
    ```

    The log recorded the takeover without stopping it: `role.update` (by 100001), `account.resetPassword` and `account.disableTwoFactor` (by 100003, on 100001), then `account.changePassword` (100001).
  - The switch is "كلمات المرور المؤقتة" on the vice-dean's grid. That is a plausible choice for a vice-dean who helps trainers while a head is away, and the grid gives no warning:
    - Since UX review 1, its two-factor line shows only while `auth.requireTwoFactor` is on.
    - With that setting on, the vice-dean would set up their own two-factor first and then go on.

    The seeded grid alone does not open this path.
  - `people.manage` reaches every account in the same way. Whoever holds it can change an admin's sign-in email and disable every admin but the last: `updatePersonAction` and `disableAccountAction` check the key only.
- **Fix.**
  - In `reachesAccount()`, a key held across the college reaches an account only when the actor holds every key that account holds.
    - The system role holds every key, so admins still reach everyone.
    - The department rule stays as it is.
  - `updatePersonAction` and `disableAccountAction` check reach too: `ctx.requireReach("people.manage", person)`.
  - Tests:
    - `reach.test.ts`: a vice-dean holding the key reaches a trainer, not an admin and not a head.
    - A matrix row, and the probe as an integration test.
  - Amend ADR-0014 #3 ("the same key and reach"). The grid's description of the two account keys says whom they reach.
- **Cost:** about 1 h.

### M3. A people import holds the college row for as long as it runs, and every sign-in and audited change in the college waits for it

- **Evidence.**
  - `importPeople` locks the college with `SELECT … FOR UPDATE` (`src/modules/access/server/people-import.ts:300-304`). Inside that transaction it creates each new account and hashes its temporary password (`:331`). Better Auth's scrypt takes 90.7 ms per hash (p50, on Node's thread pool).
  - `FOR UPDATE` conflicts with the `FOR KEY SHARE` lock that every foreign-key check takes. Nine tables reference `colleges`:
    - `audit_events`, `settings`, `memberships`, `roles` and `people`;
    - `departments` and `department_rayat_values`;
    - `notifications` and `notification_prefs`.

    So an insert into any of them waits: every sign-in (`session.signIn`), every audited action and every notification.
  - Measured with the domain function, while a second connection inserted an audit event every 50 ms (`lead_b_lock`):

    | New people | Import | Longest audit insert |
    | --- | --- | --- |
    | 40 | 3,828 ms | 3,814 ms |
    | 400 | 36,504 ms | 36,492 ms |

    At 91 ms a row, the 2,000 rows the action accepts (`MAX_PEOPLE_ROWS`) hold the lock about 3 minutes.
  - Through the server: a demo trainer's sign-in, from the press to Today, took 365 ms. While a transaction held the college row as the import does, it took 4,382 ms.
  - The lock mode decides it. With another session holding the row for 3 s, an audit insert waited:
    - 2,591 ms under `FOR UPDATE`;
    - 84 ms under `FOR NO KEY UPDATE`;
    - 92 ms under `pg_advisory_xact_lock`.

    The last two are `docker exec`'s own overhead.
  - The 40-row import alone takes 3.8 s, against section 4's 1 s for writes.
  - The same `FOR UPDATE` on the college row sits in `lockCollege` in `src/modules/org/server/departments.ts:91` and `src/modules/access/server/roles.ts:160`, and in `updateCollege`. Those transactions are short, but they stall the college the same way while they run.
- **Fix.**
  - One college lock for all three: `pg_advisory_xact_lock` on the college, as `setSetting` already does for a setting, or `FOR NO KEY UPDATE`. Imports, department changes and role names still run one at a time per college, and nothing else waits.
  - Hash the new accounts' temporary passwords before the transaction, four at a time on the thread pool: 40 rows then take about 1 s.
  - Test: an audit insert started during an import finishes before the import does. It fails today.
- **Cost:** about 1.5 h.

### M4. The log's and the notification center's pages do not use the indexes made for them: each first page sorts the whole table

- **Evidence.**
  - The app sends `order by "audit_events"."created_at" desc, "audit_events"."id" desc` (from the statement log; `src/modules/audit/server/read.ts:101`). PostgreSQL reads `desc` as `NULLS FIRST`.
  - The three log indexes and the center's are `DESC NULLS LAST` (migration `0010`, lines 1-3; `0011`, lines 27-28), drizzle-kit's default for `.desc()`.
  - An index gives an `ORDER BY` only when the null order matches, so none of these gives the order. `EXPLAIN (ANALYZE, BUFFERS)` on `lead_b_lock` (301,387 events and 100,534 notifications):

    | Query | As the app sends it | With `desc nulls last` |
    | --- | --- | --- |
    | The log's first page | Parallel Seq Scan and top-N heapsort, 32.9 ms (60.4 ms on the first run) | Index Only Scan on `audit_events_college_time_idx`, 0.100 ms |
    | One person's events, as actor | Bitmap scans and top-N heapsort, 0.427 ms | Index Only Scan on `audit_events_actor_idx`, 0.051 ms |
    | A person's notification center | Bitmap scan and sort, 0.511 ms | Index Scan on `notifications_user_time_idx`, 0.114 ms |

  - The scan grows with the table.
    - Step 11's "100,000 events in under 300 ms" holds today; audit-12 measured 47 to 106 ms for a whole page.
    - Retention is 60 months, and Steps 13 to 38 add events. The first page reaches the budget near 3 million events.
    - The comment in `read.ts` says "the index pages any depth of the log alike", which is not so today.
- **Fix.**
  - Order with `desc nulls last` in the four calls: `read.ts:101` in audit, `:46` and `:70` in notifications. Alternatively, recreate the indexes as plain `DESC` in a migration.
  - Test: an integration test loads a few thousand events and expects the first page's plan to name the index and to have no sort.
- **Cost:** 30 to 45 min.

## Proposals, ranked by benefit over cost

| # | Proposal | Benefit | Cost | Plan change |
| --- | --- | --- | --- | --- |
| 1 | A notification opens from the bell, and a digest leaves the count once what it names is read | Journey 11, a trainer opening something new on a phone: 4 taps and 2 views become 2 taps and 1 view. The bell stops counting a digest beside what it repeats | 1.5 h | no (ADR-0015 if accepted, as `/lead-review` asks of a flow proposal) |
| 2 | Keep the settings group in the address after a save | A reload or a shared link after a save opens the group the admin was in | 20 min | no |
| 3 | An index for the log's action filter | A rare action stops scanning the whole log: 17.7 ms at 301,387 events, growing with the table | 15 min | no |
| 4 | One re-authentication helper for the actions | Three copies of the password schema, `confirmPassword` and `changeBy` become one before Steps 13 to 38 add more sensitive actions | 30 min | no |
| 5 | Page long lists, and name only the people a page shows | At 2,000 people, `/people` takes 581 ms one request at a time and sends 7.3 MB of HTML | 2 to 3 h | no |
| 6 | Give a role from the person's page | Journey 4 from the page the admin is on: 5 taps, no search and no page change, instead of 7 taps, a typed name and 2 pages | 1.5 h | no (ADR-0016 if accepted) |
| 7 | Cap what an uploaded workbook may inflate to | A 0.9 MB file held 1.1 GB of memory for 3.4 s before it was refused | 45 min, in Step 40 | no |

### 1. A notification opens from the bell, and a digest leaves the count once what it names is read

- **Now.** On a phone, the bell's panel stacks the newest unread notifications as one button, "إشعاران جديدان، عرض الكل". Its cards carry no address (`BellItem` has none, `src/app/(app)/_shell/bell.tsx`).
  - To open one, a trainer taps the bell, expands the stack, taps "عرض الكل", and taps the row in the center: 4 taps and 2 views.
  - The weekly digest repeats what is still unread. So trainer 200012's bell said "إشعاران جديدان" for one new role: the role, and the digest naming it.
- **Proposal.**
  - Each card in the stack links to its page and marks itself read, as a row of the center does. The stack's foot keeps "عرض الكل".
  - A digest stops counting as unread once every notification it names is read. The digest keeps the ids of what it names.
- **Outcomes kept:** the unread count, the center, the digest in the platform (ADR-0008) and `notification.read` in the log.
- **Cost:** 1.5 h with an iPhone end-to-end test. Step 27 sends the work loop's reminders through this bell, so the saving repeats every week for every trainer.

### 2. Keep the settings group in the address after a save

- **Now.** The screen moves between groups with `window.history.replaceState` (`src/app/(app)/settings/settings-screen.tsx:69-70`). A save's `refresh()` then puts back the address the router knows.
  - Reproduced: open `/settings`, choose "الأمان والدخول", change a value and save. The address goes from `/settings?group=security` back to `/settings`, while the screen still shows Security.
  - A reload then opens Platform, which breaks the screen's own promise that "a reload or a shared link opens it again".
- **Proposal:** change the group through the router (`router.replace("?group=…", { scroll: false })`), or with nuqs, the URL-state library section 2 names. Extend the existing tab test with a save.
- **Cost:** 20 min.

### 3. An index for the log's action filter

- `?action=department.create` scans the whole table (Parallel Seq Scan, 17.7 ms at 301,387 events), because no index leads with the action.
- Add `(college_id, action, created_at desc nulls last, id desc nulls last)` in a migration, after M4's fix so that the null order matches.
- **Cost:** 15 min.

### 4. One re-authentication helper for the actions

- The password schema `latinDigits(z.string().min(1).max(128))` appears 5 times. `confirmPassword()` is copied in `settings/actions.ts:32`, `roles/actions.ts:41` and `people/actions.ts:51`, and `changeBy()` in three action files.
- One module in `src/app/(app)/` holds them. M3's single college lock removes the other copy, `lockCollege` (three copies today).
- **Cost:** 30 min.

### 5. Page long lists, and name only the people a page shows

- **Now.** Several screens read the whole directory: the people list (`listDirectory` of everyone), a role's members, `/audit`, and every history panel. The panels read the directory only to name the people in up to 20 events (`src/app/(app)/audit/lookups.ts:11-13`).
- **Measured on `lead_b_lock`** (2,000 people, one request at a time):

  | Page | p95 | HTML |
  | --- | --- | --- |
  | `/people` | 581 ms | 7,280,356 bytes, 208,313 gzipped |
  | The trainer role, 1,993 members | 249 ms | 2.7 MB |
  | A person's page | 126 ms (39 ms at 47 people) | |
  | `/audit` | 170 ms | |
  | A head's `/people` (972 people) | 296 ms | |

- **Proposal.**
  - The people list and a role's members show the first hundred and search the rest on the server.
  - The log and the history panels name only the ids on the page.
- Section 1 puts "any number of departments" in scope. The pilot's 47 people do not need it yet, so this can wait for Step 43's larger seed.
- **Cost:** 2 to 3 h.

### 6. Give a role from the person's page

- **Now.** A person's page lists their roles and says roles are given from each role's page. Making a trainer the head of a department (journey 4) means leaving the person: the Roles tab, the role, typing the name, choosing them, the scope, then add. That is 7 taps, a typed name and 2 pages.
- **Proposal.** A small "add a role" on the person's page: the role, the scope, add. It reuses `addMembershipAction` with the same key, password step, event and notification. That is 5 taps on the page the admin is already on, for example right after "إضافة منسوب".
- **Cost:** 1.5 h.

### 7. Cap what an uploaded workbook may inflate to

- `readTable` hands the bytes to read-excel-file, which inflates every entry into memory (`src/platform/files/table.ts:14`).
- A 918,804-byte workbook whose sheet inflates to about 900 MB took 3,392 ms, and the process peaked at 1,096 MB, before `readTable` refused it.
- Only `people.manage` holders can upload, and they must be signed in. Check the archive's declared sizes, or read the sheet with a byte budget of about 20 MB. A 2,000-row file needs under 1 MB.
- **Where:** Step 40, with its upload checks.
- **Cost:** 45 min.

### Lead review A's proposals that this section bears on

They wait for the owner in docs/BACKLOG.md. I do not rank them again, but the section's evidence changes their weight:

- **Proposal 6, a load level for the server budget (ADR-0010).** At 10 concurrent requests, 16 of the 20 pages I measured exceed 300 ms at p95. Lead review A found 1 of 3, in one of its two runs. Today's p95 at that load was 275 and 291 ms in those runs and is 330 to 352 ms now; at 20 concurrent requests pages take 0.56 to 1.45 s.
- **Proposal 7, the first sign-in on the card (ADR-0012).** Step 10's import hands out 40 temporary passwords at once, and each of those people meets the forced change.
- **Proposal 10, migrations expand then contract (ADR-0011).** `v0.1-A`'s image would run on this section's schema, which drops no column, but with two hazards:
  - Its sign-in does not read `users.disabled_at`, so every disabled account could sign in again.
  - Its `loadAccess` ignores `memberships.department_id`, so the heads' department keys, `accounts.resetPassword` among them, would count across the college. Under ADR-0009 they would also send every head to set up two-factor.

### Proposed ADRs

| ADR | Decision |
| --- | --- |
| **ADR-0014, amended** (M2) | A key held across the college reaches only accounts whose keys the actor holds. Turning off two-factor keeps the temporary password's key and reach. |
| **ADR-0015, notifications open from the bell** (proposal 1, if accepted) | Bell cards open their notification, and a digest leaves the unread count once what it names is read. |
| **ADR-0016, roles given from the person's page** (proposal 6, if accepted) | A person's page gives a role in a scope, through the same action, key, password step, event and notification as the role's page. |

ADR-0011 and ADR-0012 stay reserved for lead review A's pending proposals, and ADR-0013 is unused, so the new ones here start at 0015.

## The backlog item handed to this review

| Item (docs/BACKLOG.md) | Decision | Reason |
| --- | --- | --- |
| Sign the image archives (Audit 3, enhancement 2, "for Step 40 or the next lead review") | **Leave it for Step 40**, as the backlog says | Nothing in Section B changes how updates arrive. Step 40's dependency audit is where a signing key would be kept and checked. |

## Evidence

### 1. Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` (`TESTCONTAINERS_RYUK_DISABLED=true`) | exit 0 in 96 s · `Checked 470 files in 428ms. No fixes applied.` · `Test Files  84 passed (84)` · `Tests  597 passed (597)` · `check:hardcode passed.` · `✔ no dependency violations found (412 modules, 1669 dependencies cruised)`. One `DeprecationWarning` from pg, the pg-boss one audit-12 lists among its known limits |
| `pnpm check:unused` · `drizzle-kit generate` on a scratch copy of HEAD (`git archive`) | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm build` with empty `APP_URL`, `DATABASE_URL` and `AUTH_SECRET` as in CI, then `.next/static` and `public` copied into `.next/standalone` | exit 0 · `✓ Compiled successfully in 6.6s` · `✓ Generating static pages using 3 workers (29/29) in 532ms` |
| `db:migrate`, `db:seed`, `seed:demo` on `lead_b_e2e` | `seed:demo finished with --seed 42: college 01a1615e-…` in 15.4 s. Rows: people 47, audit_events 483, notifications 94 (45 unread), notification_prefs 2, departments 3, memberships 50, settings 4, role_permissions 13 |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual` | `Running 248 tests using 2 workers` · `2 flaky` · `24 skipped` · `222 passed (4.6m)` (M1). Every skip is by design: desktop touch-target tests, phone-only and desktop-only tests, and the college-wide two-factor test, which runs on one project |
| The two-factor test, `--repeat-each 12 --retries 0 --workers 1` | `2 failed` · `12 passed (1.3m)`, the 12 including the two setup tests. On two workers both copies change one college's setting, so that run (3 of 10) does not count |
| The account-menu test, `--repeat-each 20 --retries 0 --workers 2` | `22 passed (1.5m)` |
| Timings and writes on my own standalone server (port 3300, `lead_b_e2e`), 60 requests per level after a warm-up, with the client on the same 4 vCPU machine | Tables in part 4 |
| Statement logging (`log_statement = 'all'` on `lead_b_e2e` only), one warm request per page | Table in part 4 |
| `lead_b_lock` grown by SQL to 2,000 people, 301,387 events and 100,534 notifications, with a second server on port 3301 | `EXPLAIN` results, scale timings, the import lock and the reach probe |
| GitHub | Not reachable: `gh auth status` says "Failed to log in to github.com using token (GH_TOKEN)". I could not read CI on #25 and #26 |

The production images cannot be built here: Docker builds have no network. CI's "Production stack" job (`.github/workflows/ci.yml`, `stack`) covers them:

- it builds the images, saves them with their checksums and starts the demo stack from those archives;
- it checks that only Caddy publishes ports, and that there is no route out;
- it prints an Arabic PDF from the worker;
- it runs `e2e/stack.config.ts` (12 spec files, `@database` and `@visual` left out);
- it restarts Docker and checks the stack comes back;
- it runs the first admin's first run on the production-like stack.

### 2. Integration: one department traced from where the admin fills it

There are no reports or PDFs yet (Steps 32 and 33). The trace ends at screens, the log's CSV, the import and the notifications.

- **Written:** by the admin on `/departments/new` and a department's page (`createDepartment`, `updateDepartment` in `src/modules/org`). Its name, short name and Rayat values are unique across all three in the college (Audit 3), and every change is audited.
- **Read by:**
  - **Access.** A membership's department scope (`authorize`, `permittedDepartments`), and a head's reach (`reachesAccount`).
  - **The roles pages.** The member's place, and the scope choices, which offer active departments only.
  - **The people pages.** The list's roles and places, a head's view, a person's description and roles, the add form's choices, and the import's matching by name, short name or Rayat value, case-folded.
  - **The profile.**
  - **The log, its CSV and the history panels.** `department.*` events, and membership events by id, each named by the department's current name.
  - **Notifications.** `membershipAdded` and `membershipRemoved` keep the name they were sent with, by design, and the digest repeats it.
- **Probe on the production build.** The admin renamed General Studies on its page to "العلوم العامة والأساسية", short name "العلوم الأساسية". The new name then showed on the list, the department's page and its history, the head and trainer roles' members, `/people`, a trainer's page, that trainer's profile, `/audit` and the log's CSV (1,359 rows).
  - The trainer's notifications kept "الدراسات العامة", as Step 12 decided.
  - The old full name still showed where it is meant to: the department's Rayat values and the change's own event.
  - Import rows planned with each text: the new name, the new short name and both Rayat values matched the department; the old short name "العامة" became a row error ("department").

### 3. Architecture

- **Boundaries.**
  - `pnpm check:boundaries` is green (412 modules), and every cross-module import goes through an `index.ts`. That includes the worker's jobs and the seeds.
  - `domain/` holds Zod, policies and pure functions: reach, digest moments, the people file's columns, a setting's controls.
- **Duplicated logic**, all small:
  - the college lock, three copies, all `FOR UPDATE` (M3);
  - the re-authentication glue in three action files (proposal 4);
  - the three people keys listed in `people/scope.ts` and in `navigation.ts`, as audit-12 noted;
  - the `Change` type declared in 8 files, which is harmless.
- **Transactions that read outside themselves.** `addMembership` and `removeMembership` call `getSetting(…, db)` inside `db.transaction`, on a second connection of the 10-connection pool, which has no wait timeout. Ten at once would each hold a connection and wait for an eleventh, for ever. That is unlikely for an admin action; pass `tx`, or read the language before the transaction.
- **Migrations** `0005` to `0011`. All match the schemas, and none drops a column or a table.

  | Migration | What it does | Its inverse |
  | --- | --- | --- |
  | `0005` | Adds `sessions.password_entered_at` with its backfill | Drop the column |
  | `0006` and `0011` | Create tables | Drop them |
  | `0007` | Swaps the memberships' unique key for one with the department | Re-add the old key, which fails if a person holds a role in two departments |
  | `0008` | Re-keys two foreign keys onto `(college_id, id)` | Restore the old keys |
  | `0009` | Adds `users.disabled_at` and the head's two default keys | Dropping the column forgets who was disabled; the key rows cannot be told from an admin's later grants |
  | `0010` | Indexes, the purge function and the two-factor lock trigger | Drop them and restore `0001`'s function body |

  None of the migrations states its inverse in its header (lead review A's proposal 10). The rollback hazards are listed under the pending proposals above.
- **Simplicity.**
  - Proportionate. The weight is in the BeUI components the plan names, the import's row rules, and the log's describer.
  - Since lead review A, the per-request caches took the statements per page from 16 to 8. The bell added 2 queries to every page.

### 4. Data and speed

**Statements per request**, one warm request each, as the demo admin unless named:

| Page | Statements | Repeated reads |
| --- | --- | --- |
| `/` (signed out) | 2 | none |
| `/today` (admin, or trainer), `/settings`, `/people/import` | 8 | `notifications` 2 (the bell) |
| `/notifications/preferences` · `/notifications` · `/departments` | 9 · 10 · 10 | `notifications` 2 to 4 |
| `/roles` | 11 | `memberships` 2 |
| `/people/new` · `/people` (admin or head) · `/profile` | 13 · 14 · 14 | `memberships` 2 to 3, `people` 2 |
| `/audit` | 18 | `memberships` 3: the whole directory, to name people |
| A department's page · a role's page · a person's page | 20 · 24 · 24 | `memberships` 3 to 4, `role_permissions` 2 to 3, `people` 2 to 3: the history panel reads the whole directory |

No count grows with the rows, so there is no N+1. The repeated reads are the whole-directory reads (proposal 5). The digest job runs `notify()` once per person (2 statements each), once a week.

**Indexes.** `EXPLAIN (ANALYZE, BUFFERS)` on `lead_b_lock` at 2,000 people, 301,387 events and 100,534 notifications:

- **Uses its index:**
  - `loadAccess`: `memberships_scope_unique`, 0.040 ms.
  - The bell's count and newest three: `notifications_unread_idx`, 0.330 and 0.159 ms.
  - A history panel: `audit_events_entity_idx` twice, 5.7 ms.
  - The digest's unread: `notifications_unread_idx`, 1.4 ms.
  - A role's members: `memberships_role_id_index`, 4.4 ms.
- **Reads the whole table on purpose:** the directory (3.5 ms), every membership of the college (1.3 ms), and a head's department (2.2 ms; no index on `memberships.department_id`, which this size does not need).
- **Not used:** the paging indexes (M4); the action filter has none (proposal 3).

**Server p95 in ms** at 1, 10 and 20 concurrent requests (60 requests each), standalone build, demo data:

| Page | 1 | 10 | 20 |
| --- | --- | --- | --- |
| `/` signed out | 20.2 | 252.4 | 558.5 |
| `/today` admin · trainer | 35.7 · 36.1 | 352.3 · 330.3 | 934.9 · 845.2 |
| `/settings` · `?group=security` | 45.1 · 39.9 | 463.3 · 529.8 | 1,391.8 · 1,149.5 |
| `/departments` · a department | 27.5 · 41.3 | 319.0 · 318.4 | 786.3 · 1,137.2 |
| `/roles` · head role · trainer role (40 members) | 31.5 · 47.4 · 51.1 | 317.7 · 311.9 · 378.9 | 785.5 · 951.1 · 1,197.3 |
| `/people` admin · head · a person · `/people/import` | 52.1 · 36.1 · 39.0 · 28.7 | 355.2 · 400.2 · 334.8 · 332.5 | 1,454.4 · 926.5 · 859.5 · 793.4 |
| `/audit` | 57.0 | 341.0 | 1,387.2 |
| `/notifications` admin · trainer · preferences | 26.8 · 29.1 · 28.3 | 273.2 · 316.1 · 313.4 | 715.5 · 1,132.8 · 987.2 |
| `/profile` admin · trainer | 30.0 · 28.6 | 246.3 · 266.2 | 704.7 · 791.1 |

- **Writes.** Real action requests, captured from the screens and replayed with the value swapped so that each one writes; the log counted 79 `notification.unmute` and 80 `notification.mute`:
  - turning the weekly digest off and on: 33.1 · 214.0 · 376.0 ms;
  - saving the banner text: 30.7 · 207.0 · 458.7 ms.
- **Other writes:** a sign-in, from the press to Today, took 365 ms. A 40-person import takes 3.8 s (M3).
- **Against section 4.**
  - Every read meets 300 ms one request at a time, and every write meets 1 s at 20 at once.
  - At 10 at once, 16 of 20 pages miss the read budget, so the load level is the owner's to set (lead review A's proposal 6).
  - At saturation one Node process serves 30 to 82 requests a second per page, so a page costs about 12 to 34 ms of server time.

### 5. Security

- **Permission matrix and audit test.** All 27 actions appear in both:
  - 18 checked actions in 20 matrix rows (each settings action has a row per key), and 9 permission-free ones listed on purpose: the 6 sign-in actions, `markRead`, `chooseNotification` and `turnOffOwnTwoFactor`;
  - `actions-audit` lists every action with its events.

  The CSV export is a route, not an action. It checks `audit.view`, writes `audit.export`, and only `e2e/audit.spec.ts:271` tests its 403 (audit-12, known).
- **Inputs.**
  - Every action takes a Zod schema with bounds: names 60 to 120 characters, Rayat values 1 to 20, import rows up to 2,000 with bounded cells, notification ids up to 100.
  - A setting's value passes its own schema after its key is checked. Passwords go through `latinDigits`.
- **Files.**
  - The only upload is the people file. It is read in memory and never stored, and only `people.manage` holders may send it, through Next's 1 MB body limit. Inflation is not capped (proposal 7).
  - The CSV export escapes formulas (`escapeFormulae`, `src/platform/files/table.ts`).
- **The app's database role.** It adds to `audit_events` but cannot update or delete there (`db/migrate.ts`). The purge function keeps 12 months, runs `SECURITY DEFINER` with a fixed `search_path`, and is executable by the app role only.
- **Findings:**
  - a college-wide key reaches the admins (M2);
  - an import stalls sign-ins (M3, availability);
  - inflation is uncapped (proposal 7);
  - rolling back to `v0.1-A` would let disabled accounts sign in (lead review A's proposal 10).

### 6. The section's journeys, counted

Each journey ran on the iPhone 15 emulation of the production build (`lead_b_e2e`), starting from Today.

- "Views" are the pages the phone showed after Today.
- A tap includes the one that focuses a field; the file picker and the authenticator app are not counted.
- The admin's six pages leave four tabs and "المزيد", so Settings and the log take two taps to reach.
- Each journey was measured within the 15 minutes `auth.reauthMinutes` allows after the password, except journey 9. When the password is due, a sensitive change adds 2 taps and 1 field.

| # | Journey | Views | Taps | Fields | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Admin changes the pilot banner's text | 1: `/settings` | 4 | 1 (19 characters) | |
| 2 | Admin raises the lockout threshold | 2: `/settings` > `?group=security` | 5 | 1 (the stepper) | The address drops the group after the save (proposal 2) |
| 3 | Admin adds a department with one Rayat value | 3: `/departments` > `/new` > `/departments` | 7 | 3 (39 characters) | 6 taps without the optional "إضافة": a typed value is kept on save |
| 4 | Admin makes a trainer head of a department | 2: `/roles` > the role | 7 | 2 | Proposal 6 |
| 5 | Admin gives the dean role one more key | 2: `/roles` > the role | 4 | 0 | |
| 6 | Admin adds one trainer | 2: `/people` > `/people/new` | 10 | 5 (55 characters) | The temporary password shows once |
| 7 | Admin imports 40 trainers | 2: `/people` > `/people/import` | 5 | 1 (the file) | 40 temporary passwords show once; 3.8 s of import (M3) |
| 8 | Head gives their trainer a temporary password | 2: `/people` > the person | 4 | 0 | |
| 9 | Admin disables an account | 2: `/people` > the person | 6 | 1 | With the password due; 4 taps and no field without it |
| 10 | Admin finds a trainer's events and opens one | 2: `/audit` > `/audit?q=…` | 5 | 1 | |
| 11 | Trainer opens a new notification from the bell | 2: `/notifications` > `/profile` | 4 | 0 | Proposal 1 |
| 12 | Trainer turns the weekly digest off | 2: `/profile` > `/notifications/preferences` | 4 | 0 | |
| 13 | Trainer turns two-factor on from the profile | 3: `/profile` > `/profile/two-factor` > `/profile` | 7 | 2 (25 characters) | |

- **Proposals 1 and 6** shorten journeys 11 and 4, and **proposal 2** fixes journey 2's address. The other journeys are as short as their outcomes allow:
  - a record's fields, and one choice for each role and scope;
  - the password again for what changes access (ADR-0009, ADR-0014);
  - temporary passwords shown once, because nothing is sent by email (ADR-0008).
- **Touch targets and axe** were covered by the suite's iPhone tests (all passed), so I did not measure them again.

## Owner items

Unchanged; I found none of them broken. GitHub was not reachable, so I could not read branch protection or CI on #25 and #26.

## How this review left the environment

- **Databases.** The dev database `college` is unchanged. Its `pg_dump` before and after differs only in pg_dump's random `\restrict` key: sha256 `aced33e4…` both times. `lead_b_e2e` and `lead_b_lock` were created for this review and dropped. The statement logging was set on `lead_b_e2e` only and went with it.
- **Servers.** None is running, and ports 3000, 3300 and 3301 are free. I stopped my two standalone servers (3300 and 3301) by pid, and Playwright stopped its own on 3000 after each of its five runs (one of them stopped at the setup project, after my journey had given the demo trainer a temporary password, which I then restored on `lead_b_e2e`). Testcontainers left no container; only `college-dev-postgres-1` runs.
- **Files my runs rewrote**, all gitignored:
  - `.next/`: `pnpm build`, with `.next/static` and `public` copied into `.next/standalone` as CI does; `check:types` regenerates `.next/types`.
  - `test-results/`: each Playwright run rewrote it. It now holds only `.last-run.json` from the last, passing run. The failure traces I read are copied to the session's scratchpad.
  - `.local/e2e/admin.json` and `trainer.json`: rewritten by each run's setup project, then restored byte for byte from a copy taken first.

  `playwright-report/`, `tsconfig.tsbuildinfo`, `next-env.d.ts` and `.lighthouseci/` keep their earlier timestamps.
- **Throwaway scripts** live in the session's scratchpad: timing, capture and replay, journeys, the trace, the import lock, the reach probe, the scaling SQL and the workbook probe.
- **Repository.** Nothing in it changed except this report.

## Resolution (review/lead-B)

- Branch `review/lead-B` from `review/audit-12` at `f1bb4b6`, 2026-10-22: the tree the review judged. #25 and #26 wait on the three `/design` visual baselines, so this branch goes up stacked on #26 and moves onto `main` after them. The `v0.2-B` tag goes on `main` once all three are merged.
- `/lead-review` asks for two things. Every must-fix item is fixed. Each flow proposal waits for the owner's acceptance, then gets an ADR and a note under its step before it is built.
  - Proposals 1 and 6 change flows; they wait for the owner in docs/BACKLOG.md, with proposal 4.
  - The defects among the proposals are fixed here: proposal 2, and the review's note on reads inside transactions. Proposal 3's index rides on M4's migration.
  - Proposals 5 and 7 are notes under Steps 43 and 40.
- Commits are named by title. The squash-merge to `main` is titled `lead: section B`.

| Item | Disposition | Commit |
| --- | --- | --- |
| M1: the required setup lands on the profile | **Fixed as proposed.** Once two-factor is on, the setup page sends whoever the college requires it of to Today (`twoFactorRequired`), where the action sends them, and whoever chose it to the profile. Whichever answer the browser follows last, it lands in the same place. `page.test.tsx` fails without the fix (`got 'redirect /profile'`). The end-to-end test with `--repeat-each 20 --retries 0 --workers 1`: `22 passed (2.1m)`, against 2 failed in 12 before. | `fix(auth): a finished required setup lands on Today, whichever answer arrives last` |
| M2: a college-wide key reaches the admins | **Fixed, with the rule refined.** Taken literally ("the actor holds every key the account holds"), the rule would keep a vice-dean given temporary passwords from every trainer: they never hold a trainer's `task.complete`, while a head with the same key reaches their trainers. The rule as built: a key held across the college reaches an account when its holder holds, across the college, two kinds of key. First, every key of that account that requires two-factor, the plan's line between work and administration (Step 6). Second, for an account with a role across the college, every key it holds. | `fix(access): a key across the college reaches no one holding a power its holder lacks` |
| | **The cases the review asked for.** The vice-dean reaches a trainer, but not an admin or a head. They also reach the dean, because the seeded vice-dean holds the dean's one key (`indicators.view.college`); a dean given a key the vice-dean lacks is out of reach. | |
| | **Where it applies.** `updatePersonAction` and `disableAccountAction` call `requireReach("people.manage", person)`. The person page offers edit and disable only where they reach. The grid's descriptions of the three account keys say whom they reach. ADR-0014's decisions 3 and 4 are amended. | |
| | **Tests.** `reach.test.ts`: four new cases fail under the old rule. `view.test.ts`: an admin's page offers someone holding only the people keys nothing. `tests/integration/access-reach.test.ts` runs the probe on real grants: one switch on the grid gives the vice-dean the key. The vice-dean then reaches the trainer and the dean, not the admin or the head, and the admin reaches everyone. The probe fails under the old rule. | |
| M3: an import stalls the college | **Fixed as proposed.** `lockCollege()` (`src/platform/db/college-lock.ts`), an advisory lock per college held to the transaction's end, replaces the row locks in the import, the departments' changes and the role names. `updateCollege` takes its own row `for no key update`, which foreign-key checks do not wait for. The import hashes its new accounts' temporary passwords four at a time (`temporaryCredential()`) before its writes. | `fix: the college's lock stops nothing else, and giving or taking a role uses one connection` |
| | **Test.** "keeps no lock on the college while it imports" imports 40 people and writes a sign-in's event once the import's transaction is open. It fails with the old import: `[ 'import', 'event' ]`, the import 4.0 s. | |
| The review's note: reads inside transactions | **Fixed.** `addMembership` and `removeMembership` read the college's language before their transaction, which then waits for no second connection. Test: both run on a pool of one connection; the old code fails with `waited for a second connection`. | same commit |
| M4: the paging indexes go unused | **Fixed with the review's alternative.** Migration `0012` rebuilds the paging indexes in `desc()`'s order, nulls first, instead of adding `nulls last` to every query. Indexes are few and the queries ahead are many: every query written with drizzle's `desc()` now matches, and the schema says why beside the indexes. The bell's unread index ends with the id, as its query orders. | `perf(db): the paging indexes in the order the queries ask, and one for the log's action filter` |
| | **Tests.** `tests/integration/support/plans.ts` records the statements a reader sends and explains them. The 100,000-event test reads the plans of the first page, a deep page and the action filter: `["Limit", "audit_events_college_time_idx"]` twice, then `["Limit", "audit_events_action_idx"]`. The notifications test reads a 20,000-row person's page and the bell's newest. Without the migration, both fail with `Sort` over `Seq Scan` or `Bitmap Heap Scan`. | |
| Proposal 3: an index for the action filter | **Applied** in migration `0012`: `audit_events_action_idx (college_id, action, created_at desc, id desc)`. | same commit |
| Proposal 2: the settings group after a save | **Fixed.** This is a defect: the screen promised that a reload opens the group again. The group goes into the address with `history.replaceState(null, …)`, which the router keeps. With the router's own state passed instead, a save's refresh put the old address back. The save test now chooses its group by its tab and checks the address after the save. With the old line it fails on both projects (`Received string: "http://localhost:3000/settings"`). | `fix(settings): the group stays in the address through a save` |
| Proposals 1, 4 and 6 | **docs/BACKLOG.md.** Proposals 1 and 6 change flows (ADR-0015 and ADR-0016 if accepted). Proposal 4 waits for the next step that adds a sensitive action. The owner then accepted 1 and 6, built below. | `docs: lead review B report and resolution, plan notes, backlog and changelog` |
| Proposals 5 and 7 | **Notes under Steps 43 and 40.** | same commit |
| Lead review A's proposals 6, 7 and 10 | **Their backlog lines now carry this review's evidence:** 16 of 20 pages over 300 ms at 10 at once; 40 temporary passwords handed out at once; a rollback to `v0.1-A` would let disabled accounts sign in. | same commit |
| Signed image archives (handed to this review) | **Left for Step 40**, as the review decided. | |
| To watch: the account menu test | **docs/BACKLOG.md**; it did not fail in this resolution's runs. | same commit |

**Found while fixing.** M2's longer key descriptions grew the roles grid, which moved the iPhone's sticky Save under the place where the toast appears.
- The roles test's emulated pointer then rested on the toast, which waits while it is hovered, and the test waited for it to close: 1 failed on the iPhone, on its retry too.
- The test now moves the pointer away first, as a finger leaves the screen (`e2e/roles.spec.ts`). With the old descriptions it passed unchanged, and with the new ones `8 passed`, 3 runs on each project.

### The owner's decisions (2026-10-22)

- **M2's rule as built is accepted.** The owner keeps the refined rule ("this is good, no need for stricter one"): a vice-dean given temporary passwords helps the trainers, and the dean, whose one key the seeded vice-dean holds, never an admin or a head.
- **Proposals 1 and 6 are accepted.** Each has its ADR and its note in docs/PLAN.md (under Steps 12 and 10) before its code, and both are built in this pull request.

| Item | Disposition | Commit |
| --- | --- | --- |
| Proposal 1: a notification opens from the bell (ADR-0015) | **Built.** Each card on the bell's stack is a link to its page; opening it reads the notification first, as a row of the center does (`openItem` in `_shell/bell.tsx`). While the stack is closed the newest card opens with one tap, and the foot opens the list, then leads to the center. Only the keyboard's focus opens the list, so a browser that focuses on contact does not spread the cards under a finger mid-tap. | `feat(notifications): a notification opens from the bell, and a digest is read with what it counts` |
| | **The digest.** It keeps the ids of every notification it counts (`digestOf`, the job, `seed:demo`), and `markRead` reads an unread digest whose counted notifications are all read, in the same transaction and the same `notification.read` event. Digests sent before keep no ids and stay. | same commit |
| | **Tests.** The digest's integration test reads three of four counted notifications, then the last: `3`, then `2` with the digest, and the events say the same; an older digest without ids stays unread. Without the digest's update it fails with `expected 1 to be 2`. `seed-demo.test.ts` checks that each seeded digest names its holder's notifications and is read no later than the last of them; with the seed's old rule it fails. End-to-end, on the desktop and the iPhone (a finger's taps there): the card opens the profile and the bell reads 0; the foot opens the list, then leads to the center, which reads nothing; the keyboard's path (Tab opens the list, Escape closes it before the panel, Enter on the foot opens it, then the center); axe on the stack closed and open. | same commit |
| Proposal 6: a role given from the person's page (ADR-0016) | **Built.** `people/give-role.tsx`, for whoever holds `roles.manage`: the role (with a placeholder, which `SelectValue` now takes), the scope (the college or an active department; none for the system role), the password step, then `addMembershipAction`, the role page's own. The empty roles line no longer sends the reader to the role pages. | `feat(people): a role given from the person's page` |
| | **Test.** End-to-end on both projects: the system role asks for no scope; the head role in a department shows on the page at once, with one `membership.create` event and one `membershipAdded` notification. The people pages' axe and 44 px checks now cover the form. | same commit |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 475 files in 435ms. No fixes applied.` · `Test Files  86 passed (86)` · `Tests  611 passed (611)` · `check:hardcode passed.` · `✔ no dependency violations found (414 modules, 1676 dependencies cruised)` |
| `pnpm check:unused` · `drizzle-kit generate` | knip exit 0 · after `0012`: `No schema changes, nothing to migrate` |
| `pnpm build`, the static files and `public` copied into `.next/standalone`, then a fresh database (`db:migrate`, `db:seed`, `seed:demo`) | exit 0, build in 20 s |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual` | `Running 248 tests using 2 workers` · `224 passed (4.7m)` · `24 skipped`, all by design · no flaky test and no `DeprecationWarning` |
| The required-setup test, `--repeat-each 20 --retries 0 --workers 1` | `22 passed (2.1m)` |

**Mutation checks.** I applied each change, ran only the named test, then restored the file.

| Mutation | Result |
| --- | --- |
| The setup page as before | `page.test.tsx`: `expected [Function] to throw error including 'redirect /today' but got 'redirect /profile'` |
| `reachesAccount` as before | `reach.test.ts` 4 failed; `view.test.ts` and `access-reach.test.ts` 1 failed each |
| `importPeople` as before (the row lock, one hash at a time) | `expected [ 'import', 'event' ] to deeply equal [ 'event', 'import' ]` |
| `addMembership` and `removeMembership` as before | `Error: waited for a second connection` |
| Migration `0012` left out | both plan tests fail: `"Gather Merge", "Sort", "Seq Scan"`, and `"Sort", "Bitmap Heap Scan"` |
| `replaceState(window.history.state, …)` as before (a build) | the save test fails on the desktop and the iPhone: `Received string: "http://localhost:3000/settings"` |

### Known limits

- A key held across the college reaches whoever holds no administrative key, and no key across the college, that its holder lacks. A college-wide holder of both account keys therefore reaches the heads, whose planning keys they may not hold. That follows the plan's own line (Step 6), and only an admin's grant makes such a holder; the grid now says whom each key reaches.
- The import still holds one pooled connection, and the college's advisory lock, while it hashes: about 1 s for 40 people, about 45 s at its 2,000-row limit. Departments, role names and other imports wait for it; nothing else does.
- The production stack's smoke did not run here: there are no images of this build. CI's "Production stack" job runs it on this pull request.

### Hand-off

- **docs/ADR/0014-two-factor-college-choice.md:** decisions 3 and 4 amended.
- **docs/PLAN.md:** notes from lead review B under Steps 40 and 43.
- **docs/BACKLOG.md:** lead review B's proposals 1, 4 and 6 and the test to watch; this review's evidence on lead review A's proposals 6, 7 and 10.
- **CHANGELOG.md:** the lead review B entry.
- **docs/ADR/0015 and 0016:** proposals 1 and 6, accepted and built; their notes under Steps 12 and 10.
- **Owner:** lead review A's pending proposals. Once #25, #26 and this pull request are merged, I tag `v0.2-B` on `main`.
