# Audit 4: steps 10-12

- Range, in run order:
  - Step 10 `3372fdd feat: people and accounts (step 10)` (PR #21).
  - Step 11 `8deb67c feat: audit log and history (step 11)` (PR #22).
  - Step 12 `e0f9ac2 feat: notifications foundation (step 12)` (PR #23).
  - `40c61b3 feat(identity): two-factor is the college's choice (ADR-0014)` (PR #24) changed Step 10's people pages and actions, so I read it with Step 10.
- Audited on `review/ux-10` at `f268dd7`: `main` plus UX review 1 (PR #25, not merged), which reworked the people pages, the person page's account actions, the shell and the design catalog. I judged the code as it stands in this tree. 2026-10-22, by the auditor agent with the karpathy-guidelines skill.
- The pull requests' descriptions could not be read (`gh auth status`: "The token in GH_TOKEN is invalid"). Stated assumptions are judged from the commit bodies, CHANGELOG.md, the plan's notes and the code's comments.
- Verdict: **no blockers, 3 major, 7 minor.**
  - Every Done when of Steps 10, 11 and 12 has a test that ran green here, and 24 of 27 mutations fail a unit or integration test. Of the other three, one is caught end to end, and two are caught by nothing (minor 7).
  - Major 1 is the finding already known: the text of an unread row in the notification center measures 4.18:1, under the 4.5:1 that WCAG AA asks.
  - Major 2 explains why no test caught it. Whether the demo trainer's notifications are read or unread depends on the day the seed runs. On some days four end-to-end tests fail; on the others, no test sees an unread row.
  - Major 3: an admin can take away their own system role while the only other admin is disabled. The college is then left with no admin who can sign in, and `pnpm admin:create` refuses to make one.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 2 m 14 s · `Checked 469 files in 722ms. No fixes applied.` · `Test Files  84 passed (84)` · `Tests  591 passed (591)` · `check:hardcode passed.` · `✔ no dependency violations found (411 modules, 1666 dependencies cruised)` |
| `pnpm check:unused` · `drizzle-kit generate` (on a scratch copy of HEAD) | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm build`, then `.next/static` and `public` copied into `.next/standalone` as CI does | exit 0 · `✓ Compiled successfully in 37.7s` · `✓ Generating static pages using 3 workers (29/29)` |
| Reseed: drop and create `college`, `pnpm db:migrate && pnpm db:seed && pnpm seed:demo` | `seed:demo finished with --seed 42: college 01a16119-…` in 15.5 s. Data: 47 people, 444 audit events, 94 notifications (45 unread), 0 notification preferences |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual e2e/people.spec.ts e2e/audit.spec.ts e2e/notifications.spec.ts` (the standalone build) | `Running 58 tests using 2 workers` · `52 passed (1.7m)` · `6 skipped`. The skips are by design: three desktop touch-target tests, the phone header and the "More" sheet on the desktop, and the folding sidebar on the iPhone. The server log also printed `[WebServer] (node:11729) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.` (minor 1) |
| The same, `-g "demo trainer"`, on a seed made with the clock at 2026-10-21T06:00Z (probe P3) | `4 failed` · `2 skipped` · `2 passed (38.5s)` (major 2) |

**Probes.** All on the production build and the dev database, or on throwaway databases (`audit12_probe`, `audit12_seed`, since dropped).

| Probe | Result |
| --- | --- |
| C1: contrast of the notification center's rows. Signed in as the demo dean, who has two unread notifications on a fresh seed, on desktop and iPhone 15 emulation. axe ran with the project's Arabic-to-Latin rewrite, and I also composited the computed colours | axe `color-contrast`, serious, on each unread row's description and `<time>`: `fg #737778`, `bg #f5f6f8`, `ratio 4.18`, `fontSize 9.0pt (12px)`, `fontWeight normal`, `expected 4.5:1`. My compositing gives the row's `oklab(0.422708 -0.0148889 -0.0762766 / 0.05)` over the white card, which is #f5f6f8: 4.19:1. The title (#4b4d4e, 14 px, weight 500) passes at 7.86:1. The same grey on a read row (white) is 4.53:1 |
| C2: axe on the bell's panel holding the same two unread notifications | `desktop []` · `iphone []`: the panel's cards are white |
| T1: the log's pages over 100,670 events (100,000 sign-ins inserted), full HTML with curl and the admin's session, three runs each | `/audit` 85-106 ms · the page after the 90,000th event 47-49 ms (50 events) · `?action=role.update` 41-45 ms · `?q=200001` 47-61 ms · a 10-day period 57-62 ms · the whole CSV export 8.8-8.9 s, 11.9 MB |
| T2: `EXPLAIN ANALYZE` of a person's history panel query over the same data | `Execution Time: 7.099 ms`: a bitmap OR on `audit_events_entity_idx` |
| P1: the domain functions on a throwaway college. Admins A and B; A disables B, then A removes A's own system role | `P1 disable B: saved` · `P1 disable A (self): self` · `P1 A removes A's own system role: removed` · `P1 enabled admins left: 0` · `P1 pnpm admin:create then: adminExists` (major 3) |
| P2: `importPeople` of two rows with `node --trace-deprecation` | The same `DeprecationWarning`, with the stack in drizzle's `node-postgres/session.js`. It is printed during the import only, after P1's calls printed nothing (minor 1) |
| P3: `seed:demo` with the clock moved by a 12-line preload around `Date`, at 06:00 UTC on each day from 2026-10-21 to 2026-10-29, and at 00:54 UTC on the 22nd | The demo trainer (200001) has `membershipAdded:UNREAD weeklyDigest:UNREAD` on Oct 21, 27 and 28, and both read on the other seven. On Oct 24 the digest is not there at all (major 2) |

**Mutation checks.** I applied each change to a scratch copy of HEAD made with `git archive`, ran the named tests there, then restored the file and checked its sha256. In that copy, `tests/unit/licensed-assets.test.ts` fails whatever the mutation (`Tests  2 failed (2)` on its own), because the copy is not a git checkout. I left those two failures out.

| Mutation | Result |
| --- | --- |
| M1: `reachesAccount` lets a department key reach holders of two-factor keys | reach.test.ts "does not reach another head, whose keys require two-factor …" fails |
| M2: … reach someone who also holds a role across the college | "does not reach someone with a role across the college …" fails |
| M3, M4, M5: `resetPasswordAction`, `turnOffTwoFactorAction` or `linkEmployeeNumberAction` without `requireReach` | the matrix's row for each fails, e.g. "resetPasswordAction runs for exactly the roles that hold accounts.resetPassword across the college, or where its person is" |
| M6: `disableAccount` without the last-admin check | "refuses one's own account and the college's last admin who can sign in, and audits the rest" fails |
| M7, M8, M9: disabling keeps the sessions; sign-in ignores a disabled account; a disabled account's session goes on | one identity.test.ts test fails for each ("a disabled account > …") |
| M10, M11: the import takes a department set aside, or gives roles without `roles.manage` | "plans each row against the college, with every reason a row cannot be imported" fails |
| M12: `updatePerson` takes another account's email | "… and refuses another account's email" fails |
| M13: audit paging with `<=` at the cursor | 2 audit-log.test.ts tests fail |
| M14: the purge's floor at 1 month instead of 12 | "removes old events through the purge alone, which keeps at least 12 months …" fails |
| M15: `db:migrate` leaves the app `UPDATE` and `DELETE` on `audit_events` | 2 app-role.test.ts tests fail |
| M16: `notify()` ignores a muted kind | 4 fail, "a kind turned off > is not delivered, while the other kinds still are" among them |
| M17, M20: the digest counts read notifications; a digest is always due | 3 and 5 digest tests fail, the inline snapshot among them |
| M18, M19: `markRead` marks anyone's notifications; the list ignores the college | one notifications.test.ts test fails for each |
| M21: turning one's own two-factor off while the college requires it | profile/actions.test.ts "refuses while the college requires two-factor …" fails |
| M25, M26, M27: no `account.disable`, `notification.read` or `account.disableTwoFactor` event | actions-audit.test.ts fails for each |
| M22: the audit export without `audit.view` | **no unit or integration test fails** (`Tests  2 failed \| 589 passed (591)`, the two being licensed-assets). e2e/audit.spec.ts:271 expects the 403 |
| M23: the history panel without `audit.view` | **no test fails** (the same counts), and no end-to-end test checks it (minor 7) |
| M24: the import without its college lock | **no test fails** (`Tests  6 passed (6)` in access-people.test.ts) (minor 7) |

**Environment note.** Docker was not running in the container (its pid file was stale), so I started `dockerd` and the existing `college-dev-postgres-1`.

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 10 | 40 people import from a sample file with a preview | proven | e2e/people.spec.ts:76, on the desktop and the iPhone: a generated 40-row XLSX goes through the preview with no write, then the import. access-people.test.ts:355 "imports 40 people with their roles, …, and a second run changes nothing" |
| 10 | A head can reset passwords only inside their department (test) | proven | reach.test.ts, the permission matrix, and e2e/people.spec.ts:263 (a trainer of the head's department gets a temporary password; another department's trainer has no page). M1-M3 each fail a test |
| 10 | Every action is audited | proven | actions-audit.test.ts runs the seven people actions. M25 fails it |
| 10 | `seed:demo` adds the demo people listed in Step 43 | proven | 1 admin, the dean, the vice-dean, 3 heads, 40 trainers (12, 15 and 13), 3 of them secretaries by membership, and 1 quality reviewer, with an invited and a disabled trainer. seed-demo.test.ts |
| 11 | A test lists every server action and asserts each one writes an event | proven | actions-audit.test.ts globs every `actions.ts` (27 actions) and fails on one without a line. M25-M27 |
| 11 | The viewer pages through 100,000 events in under 300 ms | proven, at the page too | audit-log.test.ts:234 times the read. T1 times the whole page: 47-106 ms |
| 12 | The digest reaches the in-app channel for a fixture (snapshot test) | proven | notification-digest.test.ts:137, an inline snapshot of the words. M17 and M20 fail it |
| 12 | A kind the person muted is not delivered (test) | proven | notifications.test.ts:159 and e2e/notifications.spec.ts:171. M16 fails them |

**Plan rules.**

- **Hardcoded values.**
  - `check:hardcode` passes. No seeded role key appears in `src/` outside tests.
  - The new keys (`people.manage`, `accounts.linkEmployeeNumber`, `audit.view`) are permission keys in code. The head's two keys reach existing colleges through migration 0009, as Audit 3 asked.
  - Notification kinds are code, and their words are ICU messages in `messages/ar.json`. The digest's day and hour are settings.
  - The numbers left in code are guards or display counts, not policy: 2,000 rows per file, 1 MB per file (Next's own body limit), three notifications named in a digest and three on the bell.
- **Server actions.** The range adds ten: seven people actions (one from ADR-0014), two notification actions and one profile action.
  - All ten use next-safe-action with a Zod schema.
  - `people.manage` is named in the metadata of preview, import, update and disable. The temporary password, turning two-factor off and the employee number check `ctx.requireReach` with the person.
  - Marking read, choosing a kind, and turning one's own two-factor off act on the caller's own records. The matrix lists them as permission-free.
- **Audit events.** Every change writes its event in the same transaction:
  - `account.create` and `membership.create` (the import and adding one person);
  - `person.update` and `person.linkEmployeeNumber`;
  - `account.disable` and `account.enable`;
  - `account.disableTwoFactor`;
  - `notification.read`, `notification.mute` and `notification.unmute`;
  - `audit.export` and `audit.purge`;
  - `account.lockTwoFactor`, written by a trigger.

  The preview is a read. The notifications themselves, digests included, are the system's output and write no event, like session bookkeeping.
- **Screen states.**
  - `/people`: loading, an empty state with "add" for a manager, partial (a head sees their departments' people), the shell's error page and the refusal.
  - A person's page: loading, not found for someone out of reach, and the refusal. Its actions and forms follow each key.
  - `/people/new` and `/people/import`: loading and the refusal. The import's row errors are its partial state.
  - `/profile`: loading, and a line for no roles.
  - `/audit`: loading, empty with and without filters, error and refusal. Someone no longer in the college shows as "unknown".
  - The history panel: an empty line. It is hidden without the key (minor 7).
  - `/notifications`: loading, empty, error, and the general words for a kind the catalog lacks. It has no refusal, since everyone has one.
  - `/notifications/preferences`: its loading state is borrowed from the center (minor 6).
  - All of these are right to left, and the iPhone runs check 44 px targets and axe. The axe runs never see an unread row (majors 1 and 2).
- **Demo data.**
  - People, as above.
  - Three weeks of history: 444 events from each person's own device.
  - 94 notifications drawn from that history, 45 of them unread, with weekly digests.
  - The seed takes 15.5 s, and a second run adds nothing.
  - Gaps: minor 5 and major 2.
- **Isolated network.** Every end-to-end test fails on a request outside the platform's origin, and all 52 passed. The production-image smoke leaves out both new specs (minor 2).

## Karpathy guidelines

1. **Think before coding: mostly stated, with two silent assumptions.**
   - Most deviations are written down where a reader finds them:
     - Step 10's reach rule is stricter than the `requirePermission(key, { departmentId })` that the plan's note proposed (CHANGELOG.md, `reach.ts`).
     - Step 11 shows the log as a list of days instead of the virtualized table (docs/design/beui-map.md).
     - Step 11 records the two-factor lock with a trigger rather than in `verifySignInCode()` (CHANGELOG.md).
     - Step 12's bell panel is a disclosure rather than the morph popover, to save 9 KiB (beui-map.md).
   - One deviation is stated in a code comment only. The import gives roles through a new `insertMembership()`, so the whole import runs in one transaction, where the note under Step 10 (docs/PLAN.md:831) names `addMembership()`.
   - Two assumptions are silent:
     - The notification tests assume the demo trainer has nothing unread, which holds only on some days (major 2). PR #24 knew that later demo data shifts with each random draw: its seed change was "chosen without a draw so the demo data after it is unchanged". It did not carry that to the calendar.
     - Step 11 changed the lead reviewer's instructions without saying so (minor 3).
2. **Simplicity: proportionate.**
   - **Step 10.** About 1,700 lines of app code, mostly the import: a 378-line service and a 425-line flow. Each branch serves a row error the plan names, or a real file: Windows-1256 for a CSV saved by Arabic Excel is five lines. The form that adds one person reuses the import's action.
   - **Step 11.** About 1,700 lines of BeUI components that the plan names (date range picker, popover, collapsible, animated sidebar). The log itself is about 1,000 lines: the page, filters, list, describer, export and panel.
   - **Step 12.** Its module is about 470 lines. The rest is BeUI's notification stack and its gesture hooks.
   - Nothing is speculative. The general words for an unknown kind cover rows that a later version could leave without words.
   - One small duplication: the three people keys are listed twice, in `src/app/(app)/people/scope.ts:33-37` and in the people item of `src/app/(app)/_shell/navigation.ts`.
3. **Surgical changes: good, with one exception.**
   - Each earlier file the range touches serves the step:
     - the sign-in form's "disabled" answer;
     - two badge states;
     - the account menu's link that now closes the menu;
     - the moved password step;
     - `insertMembership()` taken out of `addMembership()` for the import;
     - the sidebar rebuilt on the animated sidebar, as the note from Step 5 asks.
   - Step 12 also fixed Step 11's date picker, whose "today" now comes from the college's clock. Its commit body names the fix. It is small and right, but outside the step.
   - The exception is Step 11's edit to the lead reviewer's charter (minor 3).
   - knip is clean, and there is no formatting churn.
4. **Goal-driven: strong in the services, weak on the screen.**
   - Every Done when has a test, and 24 of 27 mutations fail one.
   - The one new list state that matters, an unread row, is tested by nothing on most days (majors 1 and 2).
   - Two guards have no test at all (minor 7).

## Findings

### Blocker

None.

### Major

**1. The text of an unread row in the notification center fails contrast: 4.18:1 where WCAG AA asks 4.5:1.**

- **Where.**
  - `src/app/(app)/notifications/notification-list.tsx:95` gives an unread row `bg-primary/5`.
  - The row's description (`:119`) and time (`:127`) keep `text-muted-foreground`. That is `--muted-foreground: var(--palette-gray-2)` (`src/styles/tokens.css:76`), #737778.
- **Measured** (probe C1). On the desktop and on the iPhone, axe reports `color-contrast`, serious, at each unread row's description and `<time>`: `fg #737778`, `bg #f5f6f8`, `ratio 4.18`, 12 px normal text, `expected 4.5:1`. Compositing the computed colours myself gives 4.19:1.
  - The title passes at 7.86:1.
  - The same grey on a read row, on white, is 4.53:1, so the tint alone pushes it under.
  - The bell's panel with the same unread notifications passes (C2), since its cards are white.
- **Does any end-to-end test cover an unread row's colours? No.**
  - The only axe check of `/notifications` is e2e/notifications.spec.ts:245-258. It runs as the demo trainer and asserts that the bell's panel is empty (`:256`), so it expects no unread row. On a seed made on 2026-10-22, both of the trainer's notifications are read, and it passed here.
  - The two tests that make unread rows (`:115` and `:209`) run no axe and check no colour.
  - No visual baseline covers `/notifications`. The only visual spec is e2e/design.visual.spec.ts, for `/design`.
  - On the days that major 2 names, the axe test does see unread rows. On a seed made on 2026-10-21, it fails with exactly this violation.

Fix:
- Give an unread row's secondary text the colour that hover already gives it. At `:119` and `:127`, use `notification.unread ? "text-foreground" : "text-muted-foreground"`, which measures 7.86:1 on the tint. Alternatively, drop the tint at `:95` and let the dot, the medium weight and the "unread" label carry the state.
- Test it with the test's own data. In the test at notifications.spec.ts:209, right after `visit(page, "/notifications")`, while both rows are unread, add `expect(await seriousViolations(page)).toEqual([])`. It then runs on the desktop and the iPhone, whatever the seed holds.

Cost: 20 min.

**2. The demo trainer's notifications are read or unread depending on the day the seed runs: four end-to-end tests fail on some days, and on the others no test sees an unread row.**

- **What the tests assume.** The demo trainer has nothing unread.
  - e2e/notifications.spec.ts:242, `:256` and `:278` expect the bell's panel to say "لا جديد" (`stack.empty`).
  - `:253` runs axe on `/notifications`.
- **What decides it.**
  - The seed draws everything from one random stream (`createRandom(seed)`, db/seed/demo.ts:46).
  - The history counts back from the run's day and skips Fridays and Saturdays (db/seed/demo/history.ts:96, `:111` and `:355`). So the number of draws it takes depends on the calendar.
  - The notifications then draw `random() < 0.6` for each read (db/seed/demo/notifications.ts:72), and place the digests from `new Date()` (`:108`).
  - So `--seed 42` gives the named accounts a different state on different days.
- **The probe** (P3). The demo trainer has both notifications unread on a seed made on Oct 21, 27 or 28, and read on the other seven days probed.
- **The run on Oct 21's seed.** `4 failed` · `2 skipped` · `2 passed (38.5s)`:
  - On the desktop and the iPhone, "the center, the preferences and the bell's panel have no serious accessibility issue" fails with `"id": "color-contrast"` at the description and `<time>` of the two unread rows (major 1).
  - On the iPhone, "on a phone the bell stays in the header, …" and "every enabled control … has a 44 px hit area" fail with `Expected substring: "لا جديد"`.
- **The consequence.** CI's verdict on a pull request depends on the date, with no change to the code. On the days it passes, it passes because no unread row is on the screen.

Fix:
- Give the named demo accounts a fixed state, outside the shared stream. In `seedDemoNotifications`, mark the demo trainer's notifications read at their last sign-in, or keep exactly one unread on purpose and write the tests for it.
- A test that needs "nothing unread" makes it so first, by marking the person's notifications read in the database the way `sendTo` sends them. The contrast check then runs on unread rows that the test made itself (major 1).

Cost: 45 min. Enhancement 3 removes the cause for the rest of the seed.

**3. An admin can take away their own system role while the only other admin is disabled. That leaves no admin who can sign in, and `pnpm admin:create` then refuses.**

- **Disabling keeps an admin.** Step 10 promises that "the college keeps an admin who can sign in", and `disableAccount` keeps the promise: it counts the system role's members with `isNull(users.disabledAt)` (src/modules/access/server/people.ts:140-176).
- **Removing a role does not.** `removeMembership` (from Step 9) still counts every member, disabled ones included: `if (members <= 1) return { status: "lastAdmin" }` (src/modules/access/server/roles.ts:451-456). The role page's "×" uses the same count (`src/app/(app)/roles/[id]/members.tsx:63`).
- **The terminal refuses too.** `createFirstAdmin` refuses once the role has any member, disabled ones included (src/modules/access/server/first-admin.ts:30-35).
- **Probe P1:**
  ```
  P1 disable B: saved
  P1 A removes A's own system role: removed
  P1 enabled admins left: 0
  P1 pnpm admin:create then: adminExists
  ```
- **The consequence.** No one can open settings, roles, people or the log, and the platform offers no way back. Only the table's owner, working in psql, can repair it.
- **How it happens.** The sequence is ordinary: an admin who leaves is disabled rather than removed, and later the remaining admin tidies their own roles. The disabled admin still shows on the system role's page, so the "×" is enabled.

Fix:
- In `removeMembership`, count the system role's members whose accounts are enabled (join `users` on `disabled_at is null`), and refuse to remove the last of them, as `disableAccount` does.
- Let the members card's `keeps` (`members.tsx:63`) count enabled members too, through a `disabled` flag on `Member`.
- Add P1's sequence as an integration test.

Cost: 30 min.

### Minor

**1. The import runs its reads at once on its transaction's single connection, which pg deprecates.**
- **Where.** `planPeopleImport` reads with `Promise.all` (src/modules/access/server/people-import.ts:80-107 and `:130-153`). `importPeople` passes it its transaction (`:305`), which is one pg client.
- **The evidence.** The end-to-end server printed `DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.`, and probe P2 shows it comes from the import.
- **The risk.** With pg 9 this becomes an error. The integration tests would catch it at that upgrade, but the fix is cheap now.

Fix: await the reads one after another when given a transaction; they are five small queries. Cost: 15 min.

**2. The audit log's and the notifications' specs are left out of the production stack's smoke.**
- **The rule.** The note from Step 41 says that "a new journey's spec joins the list in `e2e/stack.config.ts`" (docs/PLAN.md:732).
- **What is missing.** Step 10 added people.spec.ts to the list. Steps 11 and 12 added neither audit.spec.ts nor notifications.spec.ts (e2e/stack.config.ts:20-31).
- **What never runs on the production images.** These untagged tests never run behind Caddy, as the app's non-owner database role:
  - the log's filters, the history panels, the folding sidebar and the phone's "More" sheet;
  - the refusal, with the export's 403;
  - the bell on a phone;
  - axe and the 44 px targets.

Fix: add both to `testMatch`, after major 2's fix, since the notification tests read the demo trainer's state. Cost: 15 min, plus a CI run.

**3. Step 11 edited the lead reviewer's instructions without saying so.**
- **The change.** `.claude/agents/lead-engineer.md:13`, and its copy at docs/PLAN.md:324, now ask the lead review to check "the permission matrix and the audit test (actions-audit)".
- **Why it matters.**
  - Step 1 creates these files "exactly as written here" (docs/PLAN.md:245).
  - The definition of done adds that "any decision that changes this plan gets an ADR" (docs/PLAN.md:50).
  - The addition itself is sensible. But a step changed the instructions of a review that will judge that step, and neither its commit body nor its CHANGELOG entry says so.

Fix:
- Add one line to CHANGELOG.md's Step 11 entry.
- From now on, change a reviewer's instructions in review pull requests only.

Cost: 5 min.

**4. The retention's default is recorded wrongly, and its floor is not recorded at all.**
- **The default.** CHANGELOG.md:38 says "`audit.retentionMonths` (12 by default)". The registry's default is 60 (src/modules/settings/domain/registry.ts:256-264).
- **The floor.** 12 months is the floor: the schema's `min(12)`, and `purge_audit_events()`, which refuses fewer than 12 months (db/migrations/0010_audit_paging_and_retention.sql:24).
- **Why the floor matters.** The plan leaves retention to the data classification the General Administration approves (docs/PLAN.md:861). If that asks for less than a year, a migration is needed, and nothing tells the GA request so.

Fix: correct the CHANGELOG. Record the 12-month floor and its reason (the app's role cannot shorten history) in the note under Step 11, or in an ADR that the GA request can cite. Cost: 10 min.

**5. The demo notifications and the demo log disagree, and no demo person has turned a kind off.**
- **Reads without events.** db/seed/demo/notifications.ts:70-75 marks 49 of the 94 notifications read, yet a fresh seed's log has no `notification.*` event at all. The file's own comment says the two are drawn to agree (`:21`).
- **No preferences.** `notification_prefs` is empty, so the demo data never shows:
  - a kind's "off" state in the preferences;
  - the digest skipped for a person who turned it off;
  - a `notification.mute` event.

Fix:
- Write a `notification.read` event for each reading the seed makes: by the reader, at `read_at`, with its count.
- Turn the digest off for one or two demo trainers, each with its `notification.mute` event.

Cost: 20 min.

**6. The notification preferences show the center's skeleton.**
- `src/app/(app)/notifications/loading.tsx` draws the center's day of rows.
- The preferences have no `loading.tsx` of their own, so it wraps `/notifications/preferences` too, a card of switch rows.
- Section 4 asks for "skeletons shaped like the final layout" (docs/PLAN.md:219).

Fix: add `src/app/(app)/notifications/preferences/loading.tsx`, shaped like the card: its header and three switch rows. Cost: 10 min.

**7. Two guards have no test.**
- **The history panel's key check.**
  - Whoever may read the log sees a record's history. The panel returns nothing without `audit.view` (src/app/(app)/audit/history-panel.tsx:37).
  - Removing that check passes every unit and integration test (M23).
  - No end-to-end test looks for the panel without the key. The head's test (e2e/people.spec.ts:263) opens a trainer's page but does not check it.
  - A head reaches their trainers' pages, so this check alone keeps the log's history from heads.
- **The import's college lock.** The lock at people-import.ts:300-304 keeps two imports from making the same person at once. Without it, every test still passes (M24).

Fix:
- In people.spec.ts:263, on the trainer's page, expect no region named `audit.history.title`.
- Add an integration test that starts two imports of the same row at once: one creates the person, and the other finds them already there.

Cost: 30 min.

## Enhancements (at most 3)

1. **A contrast test on the token pairs.**
   - A unit test reads `src/styles/tokens.css` and checks every text token over every surface and tint the components use (`card`, `background`, `muted`, `primary/5`, `muted/60`, …) against 4.5:1.
   - Benefit:
     - The muted grey has 0.03 of headroom on white (4.53:1), so any tint under it fails.
     - The test catches that when it is written, whatever data the end-to-end tests happen to draw.
   - Cost: about 45 min, with a small table of the tints the code uses.
2. **A calendar sweep in CI.**
   - Each night, run `seed:demo` with the clock moved to each day of the week (P3's preload is 12 lines), then the specs that read demo data (`--grep-invert @database`).
   - Benefit: it finds a test that passes only on some days before it turns CI red. Step 13's terms and `--week`, and Step 27's reminders, add many more rules about dates.
   - Cost: about 1 h, plus seven short runs a night.
3. **A random stream per record in the demo seed.**
   - Derive each person's and each week's draws from `createRandom(hash(seed, key))` instead of one shared stream.
   - Benefit:
     - A new draw no longer shifts every later person's state; PR #24 had to avoid one for that reason.
     - The calendar no longer can either.
     - Step 43's much larger seed stays stable for screenshots and tests.
   - Cost: about 1 h, and the demo data changes once.

## How this audit left the environment

- **Database `college`.** Reseeded at the end with the real clock: 47 people, 444 events, and 94 notifications, 45 of them unread. The demo trainer's two notifications are read.
  - In between, it held a seed made with the clock at 2026-10-21 (for the run under major 2), and 100,000 inserted sign-ins (for T1 and T2).
  - The throwaway databases `audit12_probe` and `audit12_seed` are dropped.
- **Docker.** `dockerd` and `college-dev-postgres-1` are running, as I started them. Testcontainers left no container behind.
- **Servers.** None is running, and port 3000 is free.
- **Files.**
  - `pnpm build` rewrote `.next/`. The static files and `public/` are copied into `.next/standalone`.
  - The end-to-end runs rewrote `.local/e2e/admin.json`, `.local/e2e/trainer.json` and `test-results/`.
  - The scratch copy, the probes and their logs are in the session's scratchpad: `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/`.
- **Repository.** Nothing changed except this report.

## Resolution (review/audit-12)

- Branch `review/audit-12` from `review/ux-10` at `f268dd7`, 2026-10-22: the tree the audit judged. UX review 1 (PR #25) waits on its three visual baselines, so this branch goes up stacked on it and moves onto `main` once #25 merges. The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor finding gets a disposition here.
- Commits are named by title. The squash-merge to `main` is titled `audit: steps 10-12`.
- `seed:demo` changes. A fresh seed now has:
  - 483 events: the 444 of the history, 37 `notification.read` events covering the 49 reads, and 2 `notification.mute` events;
  - 94 notifications, 45 of them unread, and 2 weekly digests turned off;
  - the demo trainer's two notifications read.

  It still takes 15.4 s. The seed writes notifications once, while a college has none, so an existing database keeps its own until its data is emptied.

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: an unread row's text at 4.18:1 | **Fixed as proposed.** An unread row's description and `<time>` take `text-foreground`, 7.86:1 on the tint (#4b4d4e on #f5f6f8); a read row keeps the muted grey on white. The test at notifications.spec.ts:209 runs axe, with reduced motion from the start, on the two unread rows it sends, on the desktop and the iPhone. It then opens the page again before marking them read: axe reads the page with its Arabic made Latin, so the "mark all read" button has no Arabic name until the page is drawn again. With the old grey put back on those rows, the check fails with `color-contrast` at both rows' description and `<time>`. | `fix(notifications): unread rows reach 4.5:1, checked on rows the test sends` |
| Major 2: the demo trainer's state depends on the day | **Fixed, first option.** The demo trainer's notifications are read 2 minutes after their next sign-in in the log, or after they came if none follows, never later than the run. There is no draw, so the shared stream is unchanged for everyone else. seed-demo.test.ts checks that the trainer was told something and has nothing unread. With the clock at 2026-10-21T06:00Z (P3's preload, passed through the test's `scriptEnv`), the old seed fails it (`expected 2 to be +0`) and the new one passes. P3 again over ten instants from Oct 21 to 29: both of the trainer's notifications are read on each; on Oct 24 there is no digest that week, as before. The second option, each test marking its own reads first, needs the database, which the stack's smoke does not have; the seed's fixed state serves both runs. Enhancement 3 removes the cause for the rest of the seed. | `fix(seed): the demo trainer reads everything on any day; reads and mutes in the log` |
| Major 3: the last admin who can sign in | **Fixed as proposed.** `removeMembership` counts the system role's members whose accounts are enabled. It does so under the role's row lock, which `disableAccount` also takes, so the two cannot interleave. A disabled member's role may always go. `findRole` gives each member a `disabled` flag. The members card keeps the "×" off only for the last enabled admin, marks a disabled member "حسابه معطّل", and its message says "the last admin who can sign in". The new integration test runs P1's sequence: three admins, one disabled. The first one's role goes; the second's stays (`lastAdmin`), since they are the last enabled admin; the disabled one's goes. With the old count, it fails at the second removal (`removed` where `lastAdmin` is expected). | `fix(access): the last admin who can sign in keeps the system role` |
| Minor 1: the import's reads at once on one connection | **Fixed.** `planPeopleImport` awaits its reads one after another. In three end-to-end runs that include the 40-row import, the server printed no deprecation warning. The integration tests print it once, from `worker.test.ts`. The cause is pg-boss 12.38's connect hook, which queues its session statements on each new connection ahead of the pool's own query (the stack ends in `pg-pool`'s `_acquireClient`). The import's tests print none (see Known limits). | `fix(access): the import reads in turn; its college lock and the history's key tested` |
| Minor 2: the stack's smoke leaves out two specs | **Fixed.** `e2e/stack.config.ts` lists audit.spec.ts and notifications.spec.ts. Their untagged tests read the demo admin's history and the demo trainer's state, which major 2 fixed. CI's "Production stack" job runs them on this PR; this container has no images of this build. | `test(stack): the audit log and notifications on the production images` |
| Minor 3: the lead reviewer's instructions changed unrecorded | **Recorded.** CHANGELOG's Step 11 entry names the change and the rule from now on: a reviewer's instructions change in review pull requests only. | `docs: audit 4 report and resolution, plan note, backlog and changelog` |
| Minor 4: the retention's default and floor | **Corrected and recorded.** The CHANGELOG now says "60 months by default, never under 12". A note from Audit 4 under Step 11 records the floor and its reason: the purge is the table owner's only way past the append-only triggers, so the app's own user cannot shorten history. The note also says that less than a year takes a migration, so the General Administration's request can cite it. | same commit |
| Minor 5: no read events, no preferences | **Fixed.** The seed writes one `notification.read` event for each moment someone read, by the reader, with how many, from the device of their sign-in at that moment. The two trainers the log names last (not the demo trainer) turned the weekly digest off 3 minutes after their first sign-in after joining. Each has a `notification_prefs` row and a `notification.mute` event, and gets no digest after. seed-demo.test.ts checks three things: the counts add up to the reads; the two mutes match the two preferences; no digest follows a mute. Today's data does not exercise that skip (see Known limits). | `fix(seed): …` |
| Minor 6: the preferences borrow the center's skeleton | **Fixed.** `src/app/(app)/notifications/preferences/loading.tsx` draws the header card and a card of three switch rows, busy, with no text. No new test: the shape is visual, and `loading-states.test.ts` already requires a loading state for every page. | `feat(notifications): the preferences' own skeleton` |
| Minor 7: two guards without a test | **Fixed.** In people.spec.ts, the head's test expects no region named `audit.history.title` on their trainer's page. audit.spec.ts:143 and `:188` find the same region by the same name for the admin, so the check cannot pass on a misspelled name. A new integration test starts two imports of the same row at once: one creates the person, and the other finds them there. Without the college lock it fails with `duplicate key value violates unique constraint "users_email_unique"`. | `fix(access): the import reads in turn; …` |
| Enhancement 1: a contrast test on the token pairs | **Applied.** `tests/unit/identity-tokens.test.ts` composes each tint the components paint over the card: `primary/5` (an unread notification, the pilot banner, an info alert), `muted/60` (a row under the pointer) and `alert/5` (an error alert). It checks the text colours used on each against 4.5:1. With muted text added on `primary/5`, it fails: `expected 4.186384306526972 to be greater than or equal to 4.5`. | `fix(notifications): …` |
| Enhancement 2: a calendar sweep in CI | **docs/BACKLOG.md.** About 1 h plus seven runs a night. | `docs: …` |
| Enhancement 3: a random stream per record | **docs/BACKLOG.md**, for Step 43's larger seed, since the demo data changes once. | `docs: …` |

Also in the docs commit: the note from Step 11 under Step 13 now points at `src/components/use-date-range-words.ts`, where UX review 1 moved `useDateRangeWords`.

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 470 files in 386ms. No fixes applied.` · `Test Files  84 passed (84)` · `Tests  597 passed (597)` · `check:hardcode passed.` · `✔ no dependency violations found (412 modules, 1669 dependencies cruised)` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm build`, the static files and `public` copied into `.next/standalone`, then a reseed | exit 0 · `seed:demo finished with --seed 42` |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual e2e/people.spec.ts e2e/notifications.spec.ts e2e/audit.spec.ts e2e/roles.spec.ts` | `Running 70 tests using 2 workers` · `63 passed (2.2m)` · `7 skipped`: the audit's six by design, and roles' desktop touch-target test. No `DeprecationWarning` from the server |

**Mutation checks.** I applied each change, ran only the named test, then restored the file.

| Mutation | Result |
| --- | --- |
| `removeMembership` counting every member again | access-roles.test.ts fails at `:466`: `expected { status: 'removed' } to deeply equal { status: 'lastAdmin' }` |
| `importPeople` without its college lock | access-people.test.ts "runs one import at a time per college, …" fails: `duplicate key value violates unique constraint "users_email_unique"` |
| An unread row's text and time back to `text-muted-foreground` (in the page, before axe) | notifications.spec.ts:209 fails: `"id": "color-contrast"` at both rows' description and `<time>` |
| `muted-foreground` on `primary/5` among the token test's pairs | `expected 4.186384306526972 to be greater than or equal to 4.5` |
| The seed's notifications as before this audit, with the clock at 2026-10-21T06:00Z | seed-demo.test.ts fails at `:361`: `expected 2 to be +0` (the demo trainer's unread); the new seed passes at the same clock |

### Known limits

- The integration tests still print pg's deprecation once, from pg-boss 12.38's connect hook in `worker.test.ts`. That is not this code's: pg 9 needs a pg-boss that sets up its sessions without it. Renovate brings both, and that PR's CI runs those tests.
- The two muted trainers skip no digest on today's calendar. Each one's only notification came before every digest window after their mute. The seed follows the worker's rule, and the test checks it, but the data does not exercise the skip yet. It will once later steps send notifications every week. The worker sends each digest through `notify()`, whose check of a muted kind notifications.test.ts covers (M16 fails it).
- The stack's smoke with the two specs added ran in CI only.

### Hand-off

- **docs/PLAN.md:** a note from Audit 4 under Step 11; the date picker's pointer under Step 13.
- **docs/BACKLOG.md:** the calendar sweep and the random stream per record.
- **CHANGELOG.md:** the Audit 4 entry, and the Step 11 entry's retention and reviewer lines.
- **Owner:** nothing new from this audit.
