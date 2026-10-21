# Lead review A: foundation (Steps 1 to 6)

- Section A in run order: Step 1 `650525d`, Step 2 `106b1c5`, Step 3 `1536ceb`, Audit 1 `cfa6a1b` (docs/reviews/audit-03.md), Step 4 `bc6f52e`, Step 5 `766b013`, ADR-0008 `8f77eec`, Step 6 `7e4184d`, Audit 2 `a0a0303` (docs/reviews/audit-06.md).
- Reviewed on `review/lead-A` at `a0a0303` (the same tree as `main`), 2026-10-21, by the lead-engineer agent. I ran everything against a throwaway database (`lead_a_e2e`, migrated, seeded and loaded with `pnpm seed:demo`, dropped at the end), the dev server and the standalone build in `.next/standalone`.
- Verdict: **the foundation works as a system, with 7 must-fix items (about 5 to 6 hours in all) before the `v0.1-A` tag.**
  - What holds: `pnpm check:all` is green. The 138 end-to-end tests pass on a warm server. Every lookup in the section uses an index. Lighthouse meets section 4's targets except the script budget, which ADR-0010 covers. No request leaves localhost.
  - What must be fixed: the end-to-end suite fails from a cold start. Sign-in has two security gaps: session tokens reach the logs, and the password typed again behind a session can be guessed without limit. One bad settings row takes down every page. Passwords skip the digit rule. Two cleanups that the plan and the backlog hand to this review are still open.

## Must-fix (before tagging `v0.1-A`)

Ordered as found: the failure first, then security, then availability and the plan's rules.

### M1. The end-to-end suite fails from a cold start: 2 failed, 148 did not run

- **Evidence.** Two full runs, each starting its own `pnpm dev` as `playwright.config.ts` does on a laptop, on a freshly seeded database:
  - Both runs ended with `Running 150 tests using 2 workers` · `2 failed` · `148 did not run`.
  - The failures were `[setup] › e2e/auth.setup.ts:12:1 › sign in the demo trainer` and `[setup] › e2e/auth.setup.ts:22:1 › sign in the demo admin, with the authenticator code`, with `Expected: "http://localhost:3000/today"`, `Received: "http://localhost:3000/"` (for the admin in the second run, `Received: ".../two-factor"`) and `Timeout: 5000ms`.
  - The page snapshot shows the button still saying "جارٍ الدخول" (disabled). The sign-in itself had succeeded: a `session.signIn` event was written. The dev log shows `○ Compiling /today ...` starting only after the click.
  - The first visit to `/today` on a fresh `next dev` takes longer than the 5-second expect timeout, so the setup project fails and every spec that depends on it is skipped.
  - A third run against a dev server I started and warmed first passed: `138 passed (3.8m)`, `12 skipped` (all skipped by design).
  - CI is not affected, because it tests the standalone build.
- **Fix.** Give the setup's first navigations room for a cold compile: `toHaveURL(…, { timeout: 60_000 })` at `e2e/auth.setup.ts:18` and `:31` and in `enterCode` (`e2e/support/auth.ts:33`), or set `expect.timeout` for the setup project. I checked the fix with a throwaway config (30-second expect timeout) on a fresh `next dev`: `2 passed (19.3s)`, 7.4 s per sign-in.
- **Cost:** 15 min.

### M2. Session tokens reach the logs whenever a session query fails

- **Evidence.** On the standalone build, I renamed `sessions.remembered` on the throwaway database for a moment and then renamed it back:
  - Better Auth's own console logger wrote `ERROR [Better Auth]: INTERNAL_SERVER_ERROR Error: Failed query: select "id", "token", … from "sessions" where "sessions"."token" = $1`, followed by `params: <the live session token>`. Two lines held the 32-character token.
  - A sign-in during the break produced the platform's own line `{"level":50,…,"msg":"server action failed","action":"signIn","err":{"message":"Failed query: insert into \"sessions\" … params: <token>,…","params":["<token>","<user id>",…,"127.0.0.1",…]}}`. That line carries no `requestId`.
  - Drizzle puts every query's parameters into its error (`node_modules/drizzle-orm/errors.js:12-13`), and nothing removes them:
    - Better Auth gets no `logger` option (`src/modules/identity/server/auth.ts:22-73`).
    - `handleServerError` logs `err` as it is, through the base logger (`src/modules/access/server/action-client.ts:30-37`).
    - `logRequestError` logs `err` as it is too (`src/platform/logging/request-error.ts:11-21`).
  - Any database hiccup, such as a restart, a lock or a statement timeout, therefore writes bearer tokens to the logs. A remembered device's token stays valid for 30 days. This breaks ASVS 4.0.3 V7.1.1 and Step 3's rule of a request id on every line.
- **Fix.**
  - Give pino one `err` serializer, used by the app and the worker, that drops `params` and cuts `message` and `stack` at `\nparams:`.
  - Give Better Auth a `logger` whose `log` writes through pino with the same serializer. Its "Invalid password" warnings then become JSON lines too.
  - Log action failures through `getRequestLogger()`.
  - Test: a `DrizzleQueryError` whose params hold a token produces a line without the token and with the request id.
- **Cost:** about 1.5 h.

### M3. Typing the password again behind a session is an unlimited guessing oracle

- **Evidence.**
  - With the demo trainer's session, 12 wrong current passwords sent to `changePasswordAction` answered `wrongPassword` 12 times.
  - `sign_in_lockouts` stayed at 0 rows, and no audit event was written.
  - `startTwoFactorSetup` checks the password the same way: Better Auth checks it and nothing counts the failures (`src/modules/identity/server/password.ts:42-57`, `two-factor.ts:96-105`).
  - Better Auth's own rate limit is off on purpose (ADR-0009 #1), so the lockout covers the sign-in form only.
  - Whoever holds a session, for example on a phone left open with a remembered device or on a shared lab desktop, can find the person's password at the speed of the hash, about 8 guesses a second.
  - Step 7 is about to add the general re-authentication step for admin actions, which would repeat the gap.
- **Fix.**
  - Count a wrong password typed again as an attempt on both of the account's lockout subjects (`beginAttempt`, `src/modules/identity/server/lockout.ts:30-60`).
  - At the threshold, end the account's sessions and write `account.lock`, so the next try meets the sign-in lockout.
  - Put this in one helper that Step 7's re-authentication reuses, and amend ADR-0009 #7.
  - Test: the fifth wrong current password ends the session.
- **Cost:** about 1.5 h.

### M4. One invalid stored setting turns every page, the login page included, into the error page

- **Evidence.**
  - I stored a 201-character `pilot.bannerText`; the schema allows 200. After that, the login page on an emulated iPhone showed only `تعذّر عرض هذه الصفحة حدث خطأ أثناء تحميلها. حاول مرة أخرى بعد قليل. إعادة المحاولة`, with `Minified React error #441` in the console.
  - `/today` and `/change-password` answered 200 without their content, and the server logged `Invalid stored value for setting pilot.bannerText` for each. `/healthz` and `/readyz` still answered 200, so no monitor notices.
  - The cause is that `getSetting` throws on a stored value that fails its schema (`src/modules/settings/server/get-setting.ts:23-28`). The root layout reads four settings for every page: language and time zone (`src/i18n/locale.ts`), and the banner and its text (`src/components/pilot-banner.tsx:11-15`).
  - No screen can store an invalid value today, but a later step that tightens a schema leaves old rows invalid. Then nobody can sign in, and Step 7's settings screen, the place to fix it, fails with everything else.
- **Fix.**
  - `getSetting` returns the registered default when a stored value fails its schema, and logs an error that names the key, never the value. Step 42's error events then notify the admin.
  - The test "throws, naming the key, when the stored value fails the schema" (`tests/integration/settings.test.ts:49`) and the language test at `:62` change with it.
  - Amend the consequence in ADR-0007.
- **Cost:** 30-45 min.

### M5. Passwords skip the Arabic-Indic digit rule

This decides the backlog item "digits in passwords".

- **Evidence.**
  - Section 4 asks for "Arabic-Indic digits accepted in inputs and stored as Latin", and Step 4 for the preprocessor "used by every input from Step 6 on".
  - `src/app/(auth)/actions.ts:26` is `const password = z.string().min(1).max(128)`, with no `latinDigits()`. It serves sign-in, the two-factor setup and the password change.
  - So a password set on an Arabic phone keyboard fails on a Latin one. The person then reaches a lockout and needs an admin's reset; there is no email reset.
  - No real account exists yet, so this is the cheapest moment. Once Step 10 invites people, hashes made from Arabic-Indic digits would stop matching.
  - The entropy lost is nil, because each Arabic-Indic digit is read as the same digit.
- **Fix.**
  - Wrap the `password` schema, and `confirmPassword` too so that the match check compares the same text, in `latinDigits()`, and give `confirmPassword` the same 128-character limit. Temporary and demo passwords are Latin already.
  - Integration test: a password set with Arabic-Indic digits signs in with Latin ones, and the reverse.
  - Amend ADR-0009 #2.
- **Cost:** 30-45 min.

### M6. Drop `SMTP_URL` and Mailpit

This decides an Audit 1 backlog item. The Step 12 note from ADR-0008 says it outright: "Lead review A drops `SMTP_URL` and Mailpit for good".

- **Evidence.**
  - Every environment must still supply an SMTP address that nothing uses: `src/platform/config/env.ts:12`.
  - Outside the docs, 15 lines in 10 tracked files name them: `.env.example:5`, `docker/.env.example:7`, `docker/compose.yml:22`, `docker/compose.dev.yml:16-18` (Mailpit), `.github/workflows/ci.yml:35` and `:65`, `src/platform/config/env.test.ts:7` and `:22-23`, `src/proxy.test.ts:14`, `src/app/design/gate.test.ts:27`, and `tests/integration/support/database.ts:73`.
  - Step 41 runs next and generates the local `.env`. With the variable still required, it would have to write a fake SMTP address into the production-like stack on an isolated network.
- **Fix:** remove all of them, and add a line to the CHANGELOG.
- **Cost:** 20-30 min.

### M7. Drop the `baselines` CI job

This decides an Audit 2 backlog item.

- **Evidence.**
  - `.github/workflows/ci.yml:120-165` runs on pull request events with `contents: write` (`:127`) and pushes to the branch. Its CodeQL alert has stayed open through Audit 2. With this session's token the code-scanning API answers 403, so I could not read the alert.
  - The "Done when" needs only that the baselines exist.
  - When a baseline is missing, the checks job already uploads the new files as the `visual-baselines` artifact (`:100-114`). `gh run download <run> -n visual-baselines` and a commit replace the job, and this happens only when `/design` changes.
- **Fix:** delete the job, and update the baseline comments in `ci.yml`, `e2e/design.visual.spec.ts` and the CHANGELOG.
- **Cost:** 15 min.

## Proposals, ranked by benefit over cost

| # | Proposal | Benefit | Cost | Plan change |
| --- | --- | --- | --- | --- |
| 1 | Sign-in opens the first page the person must see | Every invited person's first sign-in loses a full load of the shell and its skeleton flash | 1 h | no |
| 2 | "Remember this device" ticked by default on touch screens | The success metric "sign-ins per completed task: 1 or fewer (remembered device)" | 45 min | ADR-0012 |
| 3 | Decide ADR-0007 now: cached college settings in Step 7; keep `cacheComponents` and record why | 11 to 16 statements per page drop to 0 to 5, and static shells come back where p95 sits at the budget | 10 min now, about 2 h in Step 7 | ADR-0007 accepted with its alternative |
| 4 | Clear the two warnings on every shell page, and guard against hydration warnings | One defect class caught by the tests | 45 min | no |
| 5 | Run `e2e:screens` on the standalone build before UX review 1, and move the item where that review reads it | The UX review's captures show the product, not the dev tools | 20 min | no |
| 6 | Give section 4's server budget a load level, and test it | The 300 ms read budget stops being met by accident | 1 h 15 min | ADR-0010 amended |
| 7 | The first sign-in replaces the temporary password on the same card | 4 page views become 2, 5 fields 3 or 4, and 83 typed characters 46 or 71 for every new trainer (success metric: 4 of 5 new trainers without help) | about 3 h | ADR-0012 |
| 8 | Delete the `fs.write` worker test; keep the PostgreSQL tag in one place | Fewer false failures under Renovate's automerge | 25 min | no |
| 9 | Make the two sign-in limits do different jobs, and add a ceiling per address | One source can no longer lock every employee number or spray one password across them | 1.5 h, in Step 40 | ADR-0009 amended |
| 10 | Migrations expand, then contract, and each states its inverse | Rolling back to the previous image tag works without restoring data | 1.5 h | ADR-0011 |
| 11 | End two-factor setup without the redirect bounce | Admins stop seeing the login page flash, and ADR-0009 #9 holds | 1 h | no |
| 12 | Move the lockout tables' purge off the sign-in path | Removes a sequential scan from every attempt | 30 min | no |

### 1. Sign-in opens the first page the person must see

- **Now.** After a temporary password, the sign-in answers `signedIn`, and the form loads `/today` from scratch. The shell then redirects to `/change-password` (`src/modules/access/server/viewer.ts:38-40`). The answer has already started streaming, so the redirect is a streamed one: on the iPhone 15 emulation I saw the views `/ > /today > /change-password` with no 3xx response.
- **Proposal.** The sign-in action answers with the destination: `/change-password` for `mustChangePassword`, `/two-factor/setup` when `loadAccess()` gives a key that requires two-factor, and `/today` otherwise. It uses the same rules `requireViewer()` applies. The password change answers the same way, which saves the first admin a second hop.
- **Outcomes kept:** the forced change and the two-factor setup still come before anything else, and `requireViewer()` stays the guard.
- **Cost:** 1 h with tests.

### 2. "Remember this device" ticked by default on touch screens

- **Now.** The checkbox starts unticked (`src/app/(auth)/sign-in-form.tsx:17`). A trainer who leaves it unticked signs in again after every 60 minutes without a request, which works against section 1's metric "sign-ins per completed task: 1 or fewer (remembered device)".
- **Proposal.**
  - A setting `auth.rememberByDefault` with the values `never`, `touch` and `always`, default `touch`. The form ticks the box where `(pointer: coarse)` matches, that is on phones and tablets.
  - The hint about shared devices stays, and so does the 30-day limit.
- **Trade-off for the owner:** a shared tablet. That is why this needs ADR-0012.
- **Cost:** 45 min with an iPhone end-to-end test.

### 3. Decide ADR-0007 now

This decides the Audit 1 backlog item on `cacheComponents` and `partialPrefetching`.

- **Now.** The flags buy nothing today: the root layout reads the locale per request (ADR-0007, proposed and past its own deadline). They do cost 18 `await connection()` calls in 12 files, `instant = false`, `instantInsights` in `next.config.ts`, and status decisions moved into `src/proxy.ts`.
- **Measured.** Per request, the login page runs 11 statements (`colleges` 4 times and `settings` 7 times), Today 16 (8 of them `settings` and 3 `colleges`), and `/change-password` 16 (10 of them `settings`).
- **Proposal.**
  - Keep both flags and record why in ADR-0001 now (10 min). They are what make ADR-0007's cached alternative possible.
  - In Step 7, cache the college and all its stored settings with `"use cache"` and a college tag, which `setSetting` invalidates. This replaces Step 7's note about a per-request cache, so there is one mechanism, not two.
  - It also removes the "find the college, then the setting or its default" code repeated in `src/i18n/locale.ts`, `src/components/pilot-banner.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/page.tsx` and `src/app/(app)/layout.tsx`.
- **If the owner keeps the per-request read instead,** remove both flags and the `connection()` calls (about 1 h), because they then cost workarounds for nothing.

### 4. Clear the two warnings on every shell page, and guard against hydration warnings

- **Hydration mismatch.** The dev log recorded "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties" four times during the end-to-end run, all at the account menu's trigger (`- tabindex="0"`).
  - Cause: `src/components/motion/bloom-menu.tsx:277`, `whileTap={reduce ? undefined : …}`. `useReducedMotion()` is null on the server, so every viewer who has asked for reduced motion gets the mismatch.
  - Fix: drop the branch, since `MotionConfig reducedMotion="user"` already stops the transform.
- **Desktop LCP.** On desktop widths, Next.js warns that `/brand/element-curves.png`, the sidebar art, which loads lazily, is the largest paint.
  - Fix: make it a CSS background, so that it is no paint candidate and phones still never fetch it.
- **Guard.** An end-to-end fixture fails a test on any `hydrat` console message.
- **Cost:** 45 min.

### 5. Run `e2e:screens` on the standalone build before UX review 1

This decides an Audit 2 backlog item.

- `/ux-review` and its agent do not read `docs/BACKLOG.md`, so the item would be missed there.
- Point `e2e/screens/screens.config.ts` at `node .next/standalone/server.js`: the production build has no dev-tools button.
- Move the 390 px scale question to a note at the "Checkpoint: UX review 1" line in `docs/PLAN.md`; the UX review decides it.
- **Cost:** 20 min.

### 6. Give section 4's server budget a load level, and test it

Section 4 says "p95 under 300 ms for reads and under 1 s for writes" without saying at what load. Measured on the standalone build (4 vCPU; the client ran on the same machine):

| Concurrent requests | `/` | `/today` | `/change-password` | Sign-in action |
| --- | --- | --- | --- | --- |
| 1 | p95 23.3 ms | 29.6 ms | 25.3 ms | 133.2 ms |
| 4 | 83.0 ms | 86.8 ms | 86.2 ms | not measured |
| 10, first run | 260.2 ms | 275.0 ms | 298.4 ms | 434.2 ms |
| 10, second run | 295.5 ms | 290.9 ms | **310.3 ms** | 414.1 ms |

- The server is CPU-bound in one Node process: Today's p50 is 21, 66 and 129 ms at 1, 4 and 10 requests, about 13 ms of CPU for a page that holds an empty state. These pages are nearly empty, and later steps add their data.
- **Proposal.**
  - State the load in ADR-0010 and section 4, for example 20 concurrent requests, half the pilot at a deadline.
  - Add a one-minute k6 run at that load to Step 41's CI smoke on the production images.
  - Let Step 40 profile the render. Proposal 3's static shells are the first lever; a second app process behind Caddy is the second.
- **Cost:** 15 min to decide, about 1 h for the smoke.

### 7. The first sign-in replaces the temporary password on the same card

- **Now.** After a temporary password, the forced change asks for the temporary password a second time: 12 random characters typed again on a phone. Then the new one, then the new one again.
- **Proposal.**
  - When the sign-in finds `mustChangePassword`, the card stays and asks for the new password.
  - The form sends the temporary password it already holds as `currentPassword`, so the server still checks the current and the new password in one request, as ASVS V2.1.6 asks.
  - Optionally, replace the confirm field with the show-password toggle the sign-in form already has. The trade-off: without email resets, a mistyped new password costs an admin's reset.
- **Counts on the iPhone 15** (journey 3 below):

  | | Page views | Fields | Typed characters |
  | --- | --- | --- | --- |
  | Now | 4 | 5 | 83 |
  | With proposal 1 alone | 3 | 5 | 83 |
  | With proposal 7, keeping the confirm field | 2 | 4 | 71 |
  | With proposal 7 and the toggle instead | 2 | 3 | 46 |

- **Outcomes kept:** the temporary password is replaced before anything else, the other sessions end, and both audit events are written.
- **Cost:** about 3 h with end-to-end tests. Recorded in ADR-0012.

### 8. Two small cleanups from the Audit 1 backlog

- **Brittle tests.**
  - Delete the `fs.write` preload test (`tests/integration/worker.test.ts:165-185`). It times out if pino changes how it writes, and pino's updates merge on their own under ADR-0006. The signal tests already prove a graceful stop.
  - Keep the pool test (`tests/integration/db-client.test.ts`). It guards the choice written at `src/platform/db/client.ts:7-8`.
- **The PostgreSQL tag.** `postgres:18.6-alpine` is in six places. Keep one exported test constant and a Renovate `customManagers` regex, before the owner installs Renovate (still not installed) or with Step 41, which touches compose.
- **Cost:** 25 min.

### 9. Make the two sign-in limits do different jobs, and add a ceiling per address

- **Now.** At the shipped defaults, the per-identifier-and-address limit (`auth.signInAttempts` 10) never refuses an attempt that the lockout (`auth.lockoutThreshold` 5, from any address) would let through. It only changes the answer's wording from the 11th attempt.
  - Its own tests have to raise the lockout to 20 to reach it ("High enough that the attempts run out before the account locks", `tests/integration/identity.test.ts:342-344`).
  - Meanwhile one script on the college Wi-Fi can lock every sequential employee number for 15 minutes with five requests each, or try one common password on all of them.
- **Proposal.**
  - Ship the configuration those tests use, 5 per identifier and address and 20 overall, so one source can no longer lock a colleague out.
  - Add a ceiling of failed attempts per address across all identifiers (for example 30 in 15 minutes) against spraying.
- **Where:** Step 40, which already verifies these limits. Amend ADR-0009 #3.
- **Cost:** 1.5 h.

### 10. Migrations expand, then contract, and each states its inverse

- **Now.**
  - Drizzle has no down migrations.
  - `0003_sign_in_lockouts.sql` dropped `users.failed_sign_ins` and `users.locked_until` in the same release that stopped using them.
  - The go-live checklist's rollback is "the previous image tag and a restore point". With a column dropped, the previous image fails on the migrated database, so a rollback means restoring data and losing everything written since the backup.
- **Proposal (ADR-0011).**
  - A column or table is dropped one tagged release after the code stops reading it.
  - Each migration's header carries its inverse SQL.
  - Step 42's restore drill adds one run of the previous image against the migrated database.
- **Cost:** 30 min for the documents, about 1 h for the drill step.

### 11. End two-factor setup without the redirect bounce

- **Now.**
  - The first admin's journey on the iPhone 15 ended `/two-factor/setup > / > /today > /two-factor/setup > /today`, all as client navigations, with no document request for `/today`.
  - Better Auth replaces the session when setup is confirmed. The action's re-render of the setup page reads the old cookie, finds no viewer and redirects to `/` (`src/app/(auth)/two-factor/setup/page.tsx:19`), before the form's full load runs.
  - The key and the backup codes were gone from the page afterwards, so the security outcome holds. ADR-0009 #9's "the next page loads from scratch" is untrue on this path, though, and the login page flashes.
- **Fix:** let the confirm action end with a server redirect to a page that loads Today from scratch, or let the setup page show its "done" state when the session it was opened with has just been replaced. Add an end-to-end assertion that the setup ends with one document load of `/today`.
- **Cost:** 1 h.

### 12. Move the lockout tables' purge off the sign-in path

- Every attempt runs `delete from sign_in_attempts where window_started_at < $1` and `delete from sign_in_lockouts where started_at <= $1` (`src/modules/identity/server/sign-in.ts:78-80`, `lockout.ts:37-44`). With 100,214 rows (an enumeration run), each is a sequential scan of 5.5 ms.
- Run the purge as a pg-boss cron job in the worker, or index both columns.
- **Cost:** 30 min.

### Proposed ADRs

| ADR | Decision |
| --- | --- |
| **ADR-0011, migrations expand then contract** (proposal 10) | Drops wait one tagged release; inverse SQL in each migration's header; the previous image runs in Step 42's drill. |
| **ADR-0012, the first sign-in and remembered phones** (proposals 2 and 7; amends ADR-0009 #4 and #8) | `auth.rememberByDefault`, `touch` by default. The forced change happens on the sign-in card, with the temporary password typed once. |
| **ADR-0007, decided** (proposal 3) | The cached alternative, built in Step 7, and ADR-0001 records why `cacheComponents` and `partialPrefetching` stay. |
| **ADR-0010, extended** (proposal 6) | The server budget gets a load level, alongside the script budget. |
| **ADR-0009, amended by the must-fix items and proposal 9** | Passwords typed again count against the lockout (M3), password digits are read as Latin (M5), and the limits' defaults change with a ceiling per address added (proposal 9). |

## The backlog items handed to lead review A

| Item (docs/BACKLOG.md) | Decision | Reason |
| --- | --- | --- |
| Record why `cacheComponents` and `partialPrefetching` are on, or remove them | **Proposal 3** (10 min now, the rest in Step 7) | They earn their keep only with ADR-0007's cached alternative, which also cuts the statements per page and the render CPU. If the owner keeps the per-request read, remove them. |
| Drop `SMTP_URL` and Mailpit | **Must-fix M6** | The plan assigns it to this review (note under Step 12), and Step 41 would otherwise put a fake SMTP address into the production-like stack. |
| `seed:demo` stores `locale.timeZone`; `random` leaves the seed's context | **Leave**, and move `locale.timeZone` into the note under Step 7 that already makes `seed:demo` store the demo college's `platform.name` and `pilot.bannerText`: one change to the seed and its test | `random` stays: Step 3 requires `--seed`, its first readers are Steps 8 and 10, and taking a one-line field out to put it back two steps later is churn. |
| Delete the `fs.write` test and the pool timeout test | **Proposal 8** (5 min), for the `fs.write` test only | It is coupled to pino's internals, and pino updates merge on their own. The pool test guards a decision that `client.ts` documents. |
| One PostgreSQL tag for the tests, with a Renovate regex | **Proposal 8** (20 min), before Renovate is installed or with Step 41 | Six copies today; until Renovate is installed none of them drifts. |
| `e2e:screens` on the standalone build; the 390 px scale | **Proposal 5** (20 min), before UX review 1; the scale goes to that review | `/ux-review` does not read the backlog, so the note must sit at its checkpoint. |
| The `baselines` job and its CodeQL alert | **Must-fix M7**: drop the job | It writes to branches with `contents: write` for a step that happens once a release; two commands replace it. |
| The identity font as WOFF2 | **Leave in the backlog** | Converting a licensed file is a licence question first (ADR-0004, section 8). Lighthouse meets the targets without it: LCP 1.71 to 1.74 s on the login page. |
| Read a password's digits as Latin | **Must-fix M5** | Plan rule (section 4, Step 4), and the cheapest moment is before real accounts exist. |

## Evidence

### 1. Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 45.0 s · `Checked 257 files in 258ms. No fixes applied.` · `Test Files  54 passed (54)` · `Tests  296 passed (296)` · `check:hardcode passed.` · `✔ no dependency violations found (236 modules, 709 dependencies cruised)` |
| `pnpm check:unused` | exit 0 |
| `drizzle-kit generate` on a scratch copy of HEAD (`git archive`) | `No schema changes, nothing to migrate` |
| `db:migrate`, `db:seed`, `seed:demo` twice, on a new database `lead_a_e2e` | `seed:demo finished with --seed 42: college 01a15c88-…` both times · colleges 1, settings 1 (`locale.language`), audit_events 0, users 3, roles 1, memberships 1, two_factors 1 |
| `pnpm exec playwright test --config playwright.local.config.ts --project setup --project desktop --project iphone`, Playwright starting `pnpm dev` (twice) | `Running 150 tests using 2 workers` · `2 failed` · `148 did not run` (M1) |
| The same against a dev server started first and warmed | `138 passed (3.8m)` · `12 skipped` (11 desktop touch-target tests and the skip link on the phone, by design) |
| The setup project on a fresh `next dev` with a 30 s expect timeout (throwaway config outside the repository) | `2 passed (19.3s)`, 7.4 s per sign-in |
| `pnpm lighthouse` on the standalone build (`CHROME_PATH=/opt/pw-browsers/chromium`) | `/`: performance 0.98, 0.98, 0.98 · accessibility 1 · best practices 1 · LCP 1716, 1713, 1735 ms · CLS 0.002 · scripts 252,550 B. `/today`: 0.99, 0.98, 0.98 · 1 · 1 · LCP 1548, 1606, 1573 ms · CLS 0.002 · scripts 253,988 B. `resource-summary.script.size warning … expected: <=174080` for both (ADR-0010). Every request went to localhost |
| `curl` on the standalone build | `/` carries `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP, a nonce CSP and `Cache-Control: private, no-cache, no-store`. `POST /` from `https://example.com` → 403; without `Origin` → 403 |
| GitHub API | CI on `a0a0303`: `check:all, build and smoke test`, `Docker images`, `scan`, both `Analyze` jobs success; `Commit new visual baselines` skipped. `GET /branches/main` → `"protected":false`, rulesets `[]`; branches: `main` only; no Renovate issue |

### 2. Integration: two records traced from where they are written to every screen

There are no reports or PDFs yet, so the traces end at screens, tests and the audit log.

**The setting `pilot.bannerText`.**

- **Defined:** `src/modules/settings/domain/registry.ts:52-56`, trimmed text of 1 to 200 characters, or null for the catalog's words. `pilot.banner` turns it on (`:51`, default on).
- **Written:** by nothing in Section A. There is no screen until Step 7, `seed:demo` stores only `locale.language` (`db/seed/demo/settings.ts:9-11`), and no script writes it. Only SQL can, so Step 41's banner shows the catalog's words.
- **Read:** `getSetting()` → `PilotBanner` (`src/components/pilot-banner.tsx`) in the root layout (`src/app/layout.tsx:32`), so on every page that renders through it:
  - the sign-in pages: `/`, `/two-factor`, `/two-factor/setup` and `/change-password`;
  - `/today` and `/design`;
  - the 404 page, both `error.tsx` pages and `forbidden.tsx`.

  It does not show on `global-error.tsx`, which needs no database, by design.
- **Probe:** I stored the text `LEAD-A-BANNER-PROBE`. On the next request it showed on `/`, `/two-factor`, `/change-password`, `/today`, the 404 page, `/design` and `/` signed out, and the catalog's text was gone from each.
- **Tests:** `src/components/pilot-banner.test.tsx`. The end-to-end assertion `e2e/auth.spec.ts:47-49` expects the catalog's text, so it breaks once the seed stores one; the note under Step 7 covers this. The `/design` baselines include the banner.
- **Failure mode:** M4.

**A person's account.**

- **Written:**
  - `createAccount()` (`src/modules/identity/server/password.ts:156-177`) creates `users`, the credential `accounts` row with its hash, and `people` with the employee number.
  - `pnpm admin:create` calls it through `createFirstAdmin()`, which also adds the system role's membership and `account.create`. So do `seed:demo` (`db/seed/demo/accounts.ts`) and the end-to-end fixture.
  - The person changes the password and sets up two-factor. `resetPassword()` has no caller yet; Step 10 gives it a screen.
- **Read, in order:**
  - Sign-in finds the account by email or by college and employee number (`src/modules/identity/server/sign-in.ts:45-63`), and Better Auth creates the session.
  - `getSessionUser()` reads `people.college_id` and the session limits.
  - `getViewer()` reads memberships, roles and permissions, and works out `needsTwoFactorSetup`. `requireViewer()` sends the person to `/change-password` or `/two-factor/setup`.
  - The shell's header shows the name, email and initials in the account menu (`src/app/(app)/_shell/header.tsx`); the sidebar and header show the college's name and short name.
  - The permission keys and role keys choose the navigation (`navigation.order`) and the command palette's pages, and `/design` checks `design.view`.
  - `/change-password` hides the cancel link while `mustChangePassword` is set.
  - Every event carries `actor_id` and `entity_id`. No screen shows them until Step 11.
- **Verified:** the six journeys below ran end to end on the iPhone 15 emulation of the production build.

### 3. Architecture

- **Boundaries.** `pnpm check:boundaries` is green. Every cross-module import goes through an `index.ts`, and `domain/` imports only Zod, its own files, `platform/i18n/language` and `platform/validation/digits`. `viewerAction` is not exported yet; the note under Step 7 exports it with its first use.
- **Duplicated logic.**
  - "Find the college, then the setting or its default" appears five times (proposal 3 removes it).
  - The system role's membership is inserted in three places: `first-admin.ts`, `db/seed/demo/accounts.ts` and `e2e/support/accounts.ts`. Step 9's role assignment can give them one helper.
  - The per-identifier-and-address limit does no work at the defaults (proposal 9).
  - `MINUTE_MS` is declared three times, which is harmless.
- **Migrations.**
  - `0000` and `0002` only create, and `0001` adds the append-only triggers, explained in its header.
  - `0003` drops two columns and says that locks in progress are not carried over.
  - All four match the schemas. None states a way back (proposal 10).
- **Simplicity.** Section A is proportionate. Its weight sits in the owner-directed motion layer and the sign-in policy code, and both are covered by tests.

### 4. Data and speed

- **Indexes.** Every lookup added in Section A uses an index. The plans below were run with `EXPLAIN (ANALYZE, BUFFERS)`:
  - session by token: `sessions_token_unique`, 0.026 ms;
  - person by college and employee number: `people_college_id_employee_number_unique`, 0.108 ms in all;
  - setting: `settings_college_id_key_pk`, 0.037 ms;
  - access: `memberships_user_id_role_id_college_id_unique`, `roles_pkey` and `role_permissions_role_id_permission_pk`, 0.161 ms.

  The exceptions are small:
  - The two purge deletes are sequential scans (proposal 12).
  - The college lookup is a sequential scan of one row.
  - `createFirstAdmin()` reads memberships by `role_id`, which no index leads, once per deployment. Add the index in Step 9, which queries memberships by role and deletes roles with a cascade.
- **N+1.** There are no loops over rows. Each request fans out instead (proposal 3):
  - login page: 11 statements;
  - Today and `/change-password`: 16 each;
  - a successful sign-in action: 28. Eleven of them re-render the login page for the action's answer, which the browser then drops for the full load of `/today`; Next.js re-renders the route because the action set a cookie.
- **Server p95.** At one request at a time, reads are 23 to 30 ms and writes 133 ms, well inside section 4. At 10 concurrent requests, reads reach 291 to 310 ms (proposal 6).

### 5. Security

- **Permission matrix.** There is no matrix test yet; Step 9 builds it.
  - All six server actions in `src/app/(auth)/actions.ts` are permission-free by design (ADR-0009 #6), and the note under Step 9 lists them.
  - `viewerAction`'s refusals have unit tests. `/design` checks `design.view` in the page, and the proxy answers 404 outside a laptop.
- **Inputs.** Each of the five actions that take input has a Zod schema with bounded lengths (the confirm field only through its match with the new password, M5); `signOut` takes none. Identifiers and codes are read as Latin digits; passwords are not (M5).
- **Files.** Nothing is uploaded yet. `/brand/*` is public by design until the dean's answer on the logo (note under Step 6).
- **Findings.**
  - Secrets in the logs (M2).
  - The password typed again is an unlimited oracle (M3).
  - One source can lock or spray every identifier (proposal 9).
  - The sign-in limits trust the first `X-Forwarded-For` entry. This stays in the backlog for Steps 40 and 41.

### 6. The signing-in journey, counted

Each journey ran on the iPhone 15 emulation of the production build. A tap includes the one that focuses a field; the authenticator app is not counted. "Page views" counts the views the phone showed, including those from streamed redirects; no answer was a 3xx.

| Journey | Page views | Taps | Fields | Characters |
| --- | --- | --- | --- | --- |
| 1. Trainer, password, lands on Today | 2: `/ > /today` | 3 | 2 | 25 |
| 2. Admin, password and app code | 3: `/ > /two-factor > /today` | 4 | 3 | 31 |
| 3. Invited trainer, temporary password, forced change | 4: `/ > /today > /change-password > /today` | 7 | 5 | 83 (the temporary password twice) |
| 4. First admin: temporary password, change, two-factor setup | 7: `/ > /today > /change-password > /today > /two-factor/setup > / > /today` | 11 | 7 | 132 |
| 5. Account menu, change password (after Today) | 2 | 6 | 3 | 61 |
| 6. Account menu, sign out (after Today) | 1 | 2 | 0 | 0 |

- **Proposals 1 and 7.** Journey 3 becomes `/ > /today`, with 3 fields and 46 characters (4 and 71 with the confirm field). Journey 4 becomes `/ > /two-factor/setup > /today`, with 5 fields (6 with the confirm field), once proposal 11 removes the bounce.
- **Journeys 1, 2, 5 and 6** are as short as the plan's outcomes allow: two fields to sign in, a code for admins, current and new password to change it (ASVS V2.1.6), and two taps to sign out.
- **Touch targets.** Every control on `/`, `/two-factor`, `/today` and `/change-password` measured 44 px or more. The fields themselves are 42 px inside 44 px boxes.
- **Coverage gap.** The account menu's "change password" has integration tests but no end-to-end test.

## Owner items still open

- Protect `main` (Audit 1, major 1): `"protected":false`, rulesets `[]`. Step 41's owner item "add the new check to the required checks" needs this first.
- Install Renovate (Audit 1, minor 7): there is still no Dependency Dashboard and no `renovate/*` branch.
- ADR-0007: decide the locale read, overdue since Step 5 (proposal 3).
- ADR-0010: decide the script budget before Step 40.
- The CodeQL alert on the `baselines` job, which goes away with M7.
- The font licence for web use and PDF embedding (section 8), before go-live.

## How this review left the environment

- **Databases.** The dev database `college` is unchanged: a `pg_dump` taken before and after differs only in pg_dump's random `\restrict` key. All runs, probes and timings used `lead_a_e2e`, which I created and then dropped.
- **Servers.** Every server I started is stopped: four `pnpm dev` servers (three of them started by Playwright) and four standalone runs on port 3300. Lighthouse started and stopped its own.
- **Files.** `.local/e2e/` is restored byte for byte from a copy taken first. The gitignored outputs of the commands I ran (`test-results/`, `.lighthouseci/`, `.next/dev`) changed as those commands always change them.
- **Throwaway scripts.** The timing, journey and probe scripts live in the session's scratchpad, outside the repository.
- **Repository.** Nothing in it changed except this report.

## Resolution (review/lead-A)

- Branch `review/lead-A` from `main` at `a0a0303`, 2026-10-21. `/lead-review` asks for every must-fix item to be fixed. A flow proposal is built only once the owner accepts it, with an ADR and a note under its step written first. So the proposals that change the plan, or that are flow choices, wait for the owner in docs/BACKLOG.md. Proposals that fix a defect without changing the plan (4 and 12), and the clean-ups the backlog handed to this review (5 and 8), are done here.
- Commits are named by title. The squash-merge to `main` is titled `lead: section A`, and the section's tag `v0.1-A` follows on `main`.

| Item | Disposition | Commit |
| --- | --- | --- |
| M1: the end-to-end setup fails from a cold start | **Fixed.** The setup project waits up to 60 seconds per expectation, and two minutes per test. On a dev server whose cache was removed: `2 passed (21.2s)`. | `test(e2e): give the setup project room for a cold dev server` |
| M2: session tokens in the logs | **Fixed.** `createLogger`'s error serializer drops a query's `params` and cuts the values out of the message and the stack. Better Auth logs through it as JSON, passing only the message and an error; its "Invalid password" warning now reads `{"level":40,…,"source":"better-auth","msg":"Invalid password"}`. Action failures go through the request logger. A unit test logs a `DrizzleQueryError` that holds a token and finds the query without the token; it failed before the fix. | `fix(logging): keep a query's values, and session tokens with them, out of the logs` |
| M3: unlimited guessing behind a session | **Fixed.** `checkRetypedPassword()` (`src/modules/identity/server/retype.ts`) counts the attempt against both of the account's identifiers before the check. A right password clears both counts. The attempt that reaches the threshold locks both, ends every session and writes `account.lock`. A lock already in force refuses without a check and leaves the sessions. The password change and the two-factor setup use it, and both forms show the lockout's message. ADR-0009 #7 and the note under Step 7 make Step 7's confirmation reuse it. Three integration tests; with the count switched off, two of them fail. | `fix(identity): count a password typed again behind a session toward the lockout` |
| M4: one invalid setting breaks every page | **Fixed.** `getSetting` gives the registered default and logs the key and the college, never the value. The two settings tests now expect the fallback and the log line, and failed before the fix. ADR-0007's consequence follows. | `fix(settings): fall back to the default when a stored value fails its schema` |
| M5: passwords skip the digit rule | **Fixed.** The password schema, and the confirmation with a 128-character limit, go through `latinDigits()`. A unit test sends Arabic-Indic and Extended Arabic-Indic digits through sign-in, two-factor setup and the password change; it failed before the fix. ADR-0009 #2 follows. | `fix(auth): read a password's Arabic-Indic digits as Latin` |
| M6: `SMTP_URL` and Mailpit | **Fixed.** Removed from the environment schema, both env examples, both compose files, CI and the tests. The note under Step 12 says the SMTP step brings them back. | `chore: drop SMTP_URL, Mailpit and the CI job that committed baselines` |
| M7: the `baselines` job | **Fixed.** Deleted. The checks job still uploads a missing baseline as the `visual-baselines` artifact, and `ci.yml` and `e2e/design.visual.spec.ts` say to commit it by hand after a look. | same commit |
| Proposal 4: hydration mismatch and the guard | **Done (a defect).** The account menu always sets `whileTap`; `MotionConfig reducedMotion="user"` already stops the press. Every spec now runs on `e2e/support/test.ts`, whose automatic fixture fails on a hydration warning, or on one of React's minified hydration errors in production. With the old branch back, the shell's axe test fails on the warning. The sidebar art's desktop LCP warning is left to the UX review: its fix changes how the art loads. | `fix(ui): the account menu hydrates for reduced-motion viewers; …` |
| Proposal 5: `e2e:screens` captures | **Done (a clean-up).** A note at the UX review 1 checkpoint: build, copy the static files, then `CI=1 pnpm e2e:screens`, which uses the standalone build. The 390 px scale is that review's to decide. | `docs: …` |
| Proposal 8: brittle test, PostgreSQL tag | **The `fs.write` test is deleted; the tag goes to a note under Step 41,** which touches compose. | `test: delete the worker test that depended on how pino writes` |
| Proposal 12: the purge's scans | **Done (a defect), by indexes rather than a worker job.** Migration `0004` adds a btree index on `sign_in_attempts.window_started_at` and on `sign_in_lockouts.started_at`; it only adds. | `perf(identity): index the columns the sign-in purge deletes by` |
| CI on this branch: the identity font moved phone-sized pages when it arrived | **Fixed.** CI measured a layout shift of 0.052 on the catalog page on the iPhone screen, against the 0.05 budget. next/font sizes its Arial fallback on Latin letters only (its source says "Currently only works for the latin alphabet"). Where Arial has no Arabic, the system's Arabic font draws the text until the identity font arrives. On Linux, CI's browser among them, that font is DejaVu Sans, about 12% wider than the identity font on the 259 plain sentences of `messages/ar.json`. So the pilot banner took two lines at 393 px, then one, and the page moved up 24 px. `src/styles/fonts.css` sizes DejaVu Sans to the identity font, per weight and for Arabic letters only: 49% of those sentences now come within 3% of the identity font's width, against 4% before. The shift on the iPhone screen with this laptop's build: `/` 0.041 → 0.0005, `/design` 0.041 → 0.0022, `/today` 0.036 → 0.0008. The old build passed here at 0.041 and failed on CI. Android phones were not the cause: with their Noto Naskh Arabic, about 5% narrower, the three pages already hold still (0.0006, 0 and 0.0014). Sized to the average, it made the banner wrap, so it stays as it is. The test's failure message now lists what moved. Apple and Windows devices draw Arabic in Arial or in a system font, and neither was measured: a note under Step 41 adds the check to the phone test. | `fix(fonts): size Linux's Arabic fallback font so pages hold still when the identity font arrives` |
| Proposals 1, 2, 3, 6, 7, 9, 10 and 11 | **The owner's.** Listed in docs/BACKLOG.md, "Lead review A: proposals waiting for the owner", with their cost. Each one accepted gets its ADR and step note before it is built. | `docs: …` |
| Backlog items handed to this review | Decided as the table above says. `locale.timeZone` joins the note under Step 7, the index on `memberships.role_id` and the one helper for the system role's membership go under Step 9, the account menu's end-to-end gap under Step 10, and the PostgreSQL tag under Step 41. The WOFF2 item stays in the backlog. | `docs: …` |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 261 files … No fixes applied.` · `Test Files  54 passed (54)` · `Tests  300 passed (300)` · `check:hardcode passed.` · `✔ no dependency violations found (238 modules, 721 dependencies cruised)` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| The full end-to-end suite (setup, desktop, iPhone), with the hydration guard on every spec | dev server: `138 passed (4.1m)` · standalone build, as in CI, after the font fix: `138 passed (2.1m)` · `12 skipped` each time, all by design |
| `e2e/identity-font.spec.ts` on the standalone build, three times per test | `24 passed (23.8s)` |
| The setup project on a dev server with `.next/dev` removed | `2 passed (21.2s)` |

### You: owner checklist

- [ ] Decide the proposals waiting in docs/BACKLOG.md ("Lead review A: proposals waiting for the owner"), above all proposal 3, which is ADR-0007's decision, before Step 7.
- [ ] ADR-0010: accept the measured script budget, or choose another option, before Step 40.
- [ ] Protect `main` and install Renovate (Audit 1). The CodeQL alert on the `baselines` job closes with the job's removal; dismiss it if GitHub keeps it open.
