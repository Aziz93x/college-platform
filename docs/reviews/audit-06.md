# Audit 2: steps 4-6

- Range, in run order: Step 4 `bc6f52e feat: identity tokens and design-system base (step 04)` (PR #6), Step 5 `766b013 feat: app shell and navigation as data (step 05)` (PR #7), Step 6 `7e4184d feat: sign-in and the login page (step 06)` (PR #9). `8f77eec` (PR #8, the ADR-0008 run order) merged between Steps 5 and 6. I read it for the notes it adds to Step 6 but did not audit it as a step.
- Audited on `review/audit-06` at `7e4184d` (the same tree as `main`), 2026-10-21, by the auditor agent with the karpathy-guidelines skill.
- Verdict: **no blockers, 3 major, 11 minor.** Every "Done when" item has a passing test, except one part of Step 6's: the login page misses section 4's JavaScript budget. 12 of 14 mutations make a unit or integration test fail. The three majors are that budget, a sign-in answer that tells which accounts exist, and two-factor codes that refuse Arabic-Indic digits.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 50.7 s · `Checked 250 files in 408ms. No fixes applied.` · `Test Files  51 passed (51)` · `Tests  283 passed (283)` · `check:hardcode passed.` · `✔ no dependency violations found (232 modules, 695 dependencies cruised)` |
| `pnpm check:unused` · `drizzle-kit generate` (on a scratch copy of HEAD) | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm exec playwright test`, projects `setup`, `desktop` and `iphone`, with `playwright.local.config.ts` moved to port 3100 (a throwaway config outside the repo, `APP_URL=http://localhost:3100`) | `Running 148 tests using 2 workers` · `136 passed (4.5m)` · `12 skipped`: the 11 desktop touch-target tests and the skip-link test on the phone, both skipped by design. Per spec, desktop + iPhone: auth 9+9, security 3+3, shell 10+10, design 43+43, identity-font 4+4, health 2+2, screens/settled 2+2, plus the 2 setup tests |
| `pnpm identity:sync` (scratch copy) | `identity:sync: all 11 files are up to date.` · `src/styles/tokens.css` is byte-identical to HEAD |
| `pnpm e2e:screens` with `SCREENS_ROUTES="/ /today"` and `SCREENS_ROLES="anonymous trainer"` (output outside the repo) | `14 passed (20.1s)`, 12 captures. The 390 px captures are 1170 px wide |
| Lighthouse CI 0.15.1 with the repo's settings (mobile, `throttlingMethod: devtools`), 3 runs per URL, on the existing standalone build (built at 01:17 UTC from the clean HEAD tree; not rebuilt here) | `/`: performance 0.98, 0.98, 0.98 · accessibility 1 · best practices 1 · LCP 1720, 1742, 1740 ms · CLS 0.002 · scripts 257.2 KiB transferred. `/today` as the demo trainer: performance 0.99, 0.98, 0.98 · accessibility 1 · LCP 1764, 1867, 1948 ms · CLS 0.002 · scripts 258.6 KiB. Every request went to `localhost` |
| JavaScript on the wire (Chromium's network log, iPhone 15 emulation, same build) | `/: 18 scripts; 257.2 KiB by the load event, 0.0 KiB in the 5 s after` · `/today: 19 scripts; 221.4 KiB by the load event, 37.2 KiB in the 5 s after` |
| `pnpm admin:create` on a throwaway database `audit06_admin` (created, migrated, seeded, then dropped) | Run 1, `--employee-number ١٠٠٩`: `Admin created: audit.admin@college.example (employee number 1009).` exit 0. Run 2: `admin:create refuses: the college has an admin already. An admin creates every other account.` exit 1. The standalone build, pointed at that database, took the printed password through `/change-password` → `/two-factor/setup` → `/today`. A second sign-in with the app's code also reached `/today`. Audit events: `account.create` (system), `session.signIn`, `account.changePassword`, `account.startTwoFactorSetup`, `account.enableTwoFactor`, `session.signIn {"twoFactor":"totp"}` |
| `pnpm seed:demo` again on the seeded dev database | `seed:demo finished with --seed 42 …` · rows unchanged: colleges 1, settings 1, roles 1, memberships 1, users 3, people 3, accounts 3, two_factors 1 |
| `curl` on the standalone build | These answers carry `nosniff`, `X-Frame-Options: DENY`, the CSP, `Referrer-Policy`, `Permissions-Policy`, COOP and CORP: `/`, `/healthz`, `/brand/element-wave.png`, `/no-such-page` (404) and `/_next/image?…`. A static chunk carries all of them except the CSP, by design. `POST /` with `Origin: https://example.com` → 403; without `Origin` → 403 |
| GitHub API | Check runs on `7e4184d`: `check:all, build and smoke test`, `Docker images`, `scan`, `Analyze (javascript-typescript)` and `Analyze (actions)` succeeded; `Commit new visual baselines` was skipped. `GET /branches/main` → `"protected": false` and rulesets `[]` (Audit 1 major 1, still with the owner). Branches: `main` only; no Renovate issue (Audit 1 minor 7, still open) |

**Probes.** Each probe ran against the dev database or a throwaway one, and every account a probe made was deleted afterwards.

| Probe | Result |
| --- | --- |
| `signIn()` six times with a wrong password from one address: once for a new account, once for an employee number with no account | `existing account, six wrong passwords: invalid, invalid, invalid, invalid, locked, locked` · `unknown account, six wrong passwords: invalid, invalid, invalid, invalid, invalid, invalid` |
| The demo admin on `/two-factor`: the current code typed in Arabic-Indic digits, then in Latin digits | `typed "٩٦٤٨٤٧" (the current code 964847 in Arabic-Indic digits): URL /two-factor, alert "الرمز غير صحيح …"` · `then the same code in Latin digits: URL /today` |
| `GET /design` on a laptop (`APP_ENV=local`) | Signed out: `200`, with a streamed `NEXT_REDIRECT;replace;/;307;`. Demo trainer: `200`, with a streamed `NEXT_HTTP_ERROR_FALLBACK;404`. Demo admin: `200`, the catalog. For comparison, `/no-such-page` answers `404`, and `/today` signed out `307` to `/` |
| The text rewrite of `e2e/support/axe.ts` right after `page.goto("/")`, 3 runs | `announcer at load: false, later: true; hydration errors: 1; Arabic letters back in the page after the replacement: true` in 3 of 3 runs. The full e2e log shows the same `Hydration failed` four times, during the axe tests in auth.spec.ts and shell.spec.ts (`- aaaa aaaaaaa: aa aaaaa …` against the pilot banner's Arabic) |

**Mutation checks.** I applied each change to a scratch copy of HEAD made with `git archive`, ran only the named tests, then restored the file from HEAD and checked its sha256.

| Mutation | Result |
| --- | --- |
| `authorize` ignores the scope's college | authorize.test.ts "refuses another college, whatever the actor holds" fails |
| `viewerAction` skips the permission check | action-client.test.ts "refuses a viewer without the permission" fails |
| The proxy lets a change without an `Origin` through | proxy.test.ts: 2 fail ("refuses a change from no origin", "… from an unreadable origin") |
| Sessions never end when idle | session-policy.test.ts, and identity.test.ts "ends a session that sat idle past the college's limit", fail |
| `/design` without the `design.view` check | gate.test.ts "… renders not found for a viewer without design.view" fails |
| The identifier keeps Arabic-Indic digits | identifier.test.ts, and identity.test.ts "signs in by employee number, typed in Arabic-Indic digits …", fail |
| Sign-in limits keyed on the address alone | identity.test.ts "holds back the account at that address only …" fails |
| The system role gives no keys | access.test.ts "makes the first admin …" fails |
| Navigation ignores permissions | navigation.test.ts: 5 fail |
| A reset leaves the sessions | identity.test.ts, the resetPassword test, fails |
| No nonce in the script policy | proxy.test.ts: 2 fail |
| A lock writes `account.locked` instead of `account.lock` | identity.test.ts, the lockout test, fails |
| An unknown account answers without hashing a password (`sign-in.ts:142`) | **no test fails** (13 passed) |
| A viewer who needs two-factor is never sent to set it up (`viewer.ts:26-27`) | **no unit or integration test fails** (15 passed). By reading, only `e2e/auth.spec.ts:192` asserts the redirect; the e2e suite could not run on the scratch copy |

Environment note: another session's standalone server held port 3000 for most of this audit. The end-to-end run therefore started its own `pnpm dev` on port 3100. The Lighthouse runs and the probes used the existing standalone build on ports 3200 and 3400. The setup project wrote its signed-in states to `.local/e2e/` (gitignored). Nothing in the repository changed.

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 4 | `/design` shows every primitive | proven | design.spec.ts "shows every primitive" (26 `data-primitive` ids), desktop and iPhone |
| 4 | Visual baselines exist at the three widths | proven by CI | `e2e/design.visual.spec.ts-snapshots/design-{390,768,1440}-desktop-linux.png`. The `@visual` test compares them in CI (green on `7e4184d`); laptops skip `@visual` by design |
| 4 | axe reports no serious issues on `/design` | proven | design.spec.ts axe: the page and 10 overlays, desktop and iPhone. These tests wait for `settled()` first, and no hydration error appeared during them (minor 2 concerns the other axe tests) |
| 4 | `check:hardcode` finds no hex color outside the tokens | proven | `check:hardcode passed.` tests/unit/check-hardcode.test.ts covers hex, the functional notations, named colors and `prefers-color-scheme` |
| 4 | Arabic shapes in the identity font, with CLS under 0.05 as it loads | proven | identity-font.spec.ts, 4 tests × 2 projects: CDP platform fonts at 400 and 500, joining, and CLS with the font held back. Lighthouse CLS 0.002 |
| 5 | A unit test renders the navigation for fixture permission sets | proven | navigation.test.ts (`visibleNavigation` for five key sets and for orders; the mutation above fails 5 tests) and tab-bar.test.tsx (the phone split). The registry has one page, so only e2e proves the layout's wiring |
| 5 | Lighthouse on the shell, mobile: performance 95 or more, accessibility 100 | proven | CI on `7e4184d`. Locally, `/today` scored 0.99, 0.98 and 0.98, with accessibility 1 in all three runs. The gate counts the best of three (minor 1) |
| 6 | End-to-end tests for sign-in, sign-out, lockout, a remembered device, admin two-factor and the forced change | proven | auth.spec.ts, 9 tests on desktop and on iPhone, after the setup project |
| 6 | Every response carries the security headers (test) | proven | security.spec.ts (a page, a route handler, a static script, an optimized image) and proxy.test.ts; `curl` above |
| 6 | The login page meets the section 4 targets on phone emulation (LCP under 2.0 s) | **partly** | LCP 1.72-1.74 s, performance 0.98, accessibility and best practices 1, CLS 0.002. JavaScript per route is about 257 KiB against a 170 KB budget (major 1) |
| 6 | `pnpm admin:create` makes an admin who can sign in | proven | access.test.ts (the password prints once and signs in, a second run refuses, two runs at once make one admin) and the live run above through the production pages |
| 6 | Sign-in limits key on the account plus the address (test; ADR-0008 note) | proven | identity.test.ts "holds back the account at that address only …"; mutation above |

**Plan rules.**

- **Hardcoded values.** `check:hardcode` passes. No role is checked by name. The system role is found by `roles.system` (src/modules/access/server/first-admin.ts:25, load-access.ts:30), and every check uses a permission key (`authorize`, `viewerAction`).
- **Server actions.** `src/app/(auth)/actions.ts` holds six. All use next-safe-action and a Zod schema through `formFields`, except `signOutAction`, which takes no input and has no schema. None calls `authorize()`. Signing in is public, and the other five act on the caller's own account, as ADR-0009 #6 decides. `viewerAction` carries `authorize` and gets its first consumer in Step 7. Step 9's generated matrix test should list these six as permission-free on purpose, or it will flag them.
- **Audit events.** Each account action writes its event: sign-in, sign-out, lock, create, reset, password change and both two-factor setup steps. Reset and the first admin write it in the same transaction as the change. Tests cover sign-in, lock, create, reset and change; sign-out, the code sign-in and the two-factor setup have no test (minor 3). Two changes write no event: a failed sign-in below the threshold, which docs/BACKLOG.md records as a decision, and the two-factor lock (minor 11). `createAccount()` (src/modules/identity/server/password.ts:149) writes no event itself; only `createFirstAdmin` adds `account.create`, so Step 10's import and invite actions must add it too.
- **Screen states.** `/design` has loading, error and its not-found. The shell has loading, error, forbidden and Today's empty state. `not-found.tsx` exists, and `global-error.tsx` renders without the database (tested). The sign-in pages have an error state but no loading state (minor 9).
- **Demo data.** For Step 4, `seed:demo` stores `locale.language`. For Step 6, it adds an admin with two-factor, a trainer and an invited trainer, with realistic names. A second run changes nothing. It stores none of the 12 settings Step 6 registered (enhancement 3).
- **Isolated network.** The login page and Today request nothing outside `localhost` (Lighthouse network log). `identity:sync` reaches raw.githubusercontent.com only at build time.

## Karpathy guidelines

1. **Think before coding: good in Steps 4 and 5, weaker in Step 6.** PRs #6 and #7 list owner items and "Open findings, not fixed here", and they record their deviations in ADR-0007 and two ADR-0001 amendments. Step 6 records its decisions in ADR-0009. Three questions were still settled silently:
   - Step 6 read "meets the section 4 targets" as Lighthouse and LCP only (major 1).
   - The digit preprocessor is "used by every input from Step 6 on", but the code fields skip it (major 3).
   - Two ADR-0009 sentences do not hold. The lockout tells accounts apart (major 2), and `/design` answers refusals with 200 (minor 4).

   Two open findings also stayed in PR bodies, and ADR-0007 is still "proposed" two steps after its own deadline (minor 5).
2. **Simplicity: proportionate code under a heavy motion layer.** The platform code is small and direct: a pure `authorize`, session lifetimes as a pure function of the settings, and a hash-checked sync. The weight comes from the owner's motion direction, which the plan records. That direction brought 2,139 lines of copied BeUI components beside 1,973 lines of Step 4 primitives, and the two sets now overlap on five jobs (minor 7). It also accounts for about 52 KB of every page's 257 KiB of JavaScript (major 1). The CI job that commits baselines is more machinery than the "Done when" needs (minor 8).
3. **Surgical changes: good.** Every changed line traces to its step or to an owner direction recorded in the plan. Where Step 5 changed Step 4's code, the change served the shell:
   - `documentLocale` moved to `platform/i18n`, so `global-error.tsx` needs no database.
   - `findCollegeId` became `findCollege`, which gives the sidebar the college's name.
   - The popover fix came from a phone bug the step found.

   Orphans are gone: the placeholder page and its spec, the `/` redirect, the moved `MotionProvider`. There is no formatting churn, and knip is clean.
4. **Goal-driven: strong.** Every "Done when" item has a test, and 12 of 14 mutations make a unit or integration test fail. The admin's two-factor requirement rests on a single end-to-end test. A code sign-in's "remember this device" rests on no test at all (minor 3).

## Findings

### Blocker

None.

### Major

**1. The login page misses section 4's JavaScript budget, and the overage is recorded nowhere a later step reads.**

Step 6's "Done when" (docs/PLAN.md:614) asks that "the login page meets the section 4 targets on phone emulation". Section 4's bar (docs/PLAN.md:238) is "JavaScript per route: 170 KB gzipped or less". On the standalone build, `/` transfers 18 scripts, 257.2 KiB, in every Lighthouse run and in Chromium's network log. `/today` transfers 258.6 KiB. Both are about 1.5 times the budget. Lighthouse's transfer sizes break the login page down as follows:

- **Framework, about 145 KB:** react-dom 74 KB, the app router 37 KB, the RSC client 9 KB, `next/image` and head 15 KB, and Turbopack's runtime 5 KB.
- **Motion and its lazily loaded feature bundle, about 52 KB** (chunks `2_ohcjieua3jh.js`, `3hhp18wi-az40.js` and `43h24kirwu6xn.js` in this build). The root layout loads them on every page (src/app/layout.tsx:33).
- **Sonner, about 10 KB, on every page:** `<Toaster>` sits in the root layout (src/app/layout.tsx:37), but only `/design` ever calls `toast()` (src/app/design/overlays.tsx:270).
- **Smaller pieces:** the message formatter 13 KB and tailwind-merge 9 KB.

PR #7 saw the overage ("Section 4 budgets 170 kB per route, and Step 40 makes the budgets pass in CI"). PR #9's evidence for this item lists only Lighthouse scores, LCP and CLS. Neither docs/PLAN.md nor docs/BACKLOG.md mentions it.

Fix:
- (a) The owner decides in an ADR whether 170 KB can hold on Next.js 16 and React 19, given that the framework alone is about 145 KB. If not, the ADR sets a measured budget per route. Add a note under Step 40.
- (b) Mount `<Toaster>` only where toasts exist (`/design` for now). Load Motion's feature bundle only where an animation needs it, not on the sign-in pages if their pieces can run on CSS.
- (c) Assert the budget in `lighthouserc.json` (`resource-summary:script:size`), as a warning until Step 40.

Cost: about 1-2 h, plus the owner's decision.

**2. Five wrong passwords tell whether an account exists, against ADR-0009.**

ADR-0009 #3 (docs/ADR/0009-sign-in-and-sessions.md:16) says "An unknown account takes as long as a wrong password and gets the same answer". The comment at src/modules/identity/server/sign-in.ts:112-113 says "The answer never tells a wrong identifier from a wrong password". The code does tell them apart:

- An existing account answers `locked` after five wrong passwords, from any address (sign-in.ts:145-150 and 164-180).
- An identifier with no account keeps answering `invalid`, and `throttled` after ten attempts from one address (sign-in.ts:131-144).

The probe shows it: `existing account …: invalid, invalid, invalid, invalid, locked, locked` against six `invalid` answers for an unknown account. The page also shows a different title for each answer (`auth.signIn.locked` and `auth.signIn.invalid`). Employee numbers are short and sequential (the demo uses 100001 and 200001), and the email column will hold each person's Microsoft 365 address (the ADR-0008 note under Step 10). Anyone can therefore list the staff's accounts at five requests each, and lock each one for 15 minutes on the way.

Fix: lock an unknown identifier the same way.
- Count its failures across addresses for `auth.lockoutMinutes`, for example in `sign_in_attempts` under the key `typed:<identifier>` without the address.
- Once the count reaches `auth.lockoutThreshold`, answer `{ status: "locked", minutes }`.
- Add an unknown identifier to the lockout case in tests/integration/identity.test.ts.

Cost: about 45 min.

**3. Two-factor codes typed in Arabic-Indic digits are refused, against section 4 and Step 4.**

Section 4 (docs/PLAN.md:226) asks for "Arabic-Indic digits accepted in inputs and stored as Latin". Step 4 (docs/PLAN.md:554) asks that the shared preprocessor be "used by every input from Step 6 on". Both code fields take the text as typed:

- The sign-in code: `code: z.string().trim().min(1).max(32)` (src/app/(auth)/actions.ts:45).
- The setup code: the same with `max(16)` (actions.ts:71).
- The services strip spaces only (src/modules/identity/server/two-factor.ts:37 and :132).

Both fields ask the phone for a numeric keypad (code-form.tsx:50, setup-form.tsx:125), and on a phone set to Arabic that keypad can type Arabic-Indic digits. The probe typed the current code as `٩٦٤٨٤٧` and got "الرمز غير صحيح"; the same code in Latin digits signed in. Admins are the only people with two-factor so far. Better Auth ends a challenge after 5 wrong codes, and after 10 wrong codes in a row it locks two-factor for 15 minutes (better-auth/dist/plugins/two-factor/verify-two-factor.mjs:121-122).

Fix: wrap both code fields in `latinDigits()` (src/platform/validation/digits.ts:22). Add a test that types the code in Arabic-Indic digits, against the action's schema or in auth.spec.ts. Cost: about 20 min.

### Minor

**1. The Lighthouse gate counts the best of three runs.**
`lighthouserc.json:18,25,32,39` set `"aggregationMethod": "optimistic"` for performance, accessibility, best practices and LCP, so one good run passes them all. `/today`'s LCP already reached 1948 ms in one of three local runs. ADR-0001's Step 5 amendment says the thresholds are unchanged, but it does not mention the aggregation.
Fix: warm the server with one collect that asserts nothing, then assert the `median`. Or record the choice in ADR-0001. Cost: 15 min.

**2. The axe helper rewrites the page before React has hydrated it.**
e2e/support/axe.ts:10-21 replaces Arabic letters with `a` so that axe checks their contrast. auth.spec.ts and shell.spec.ts call it right after a navigation. React then reports `Hydration failed` (four times in the e2e log) and renders the Arabic text again, and axe skips the contrast of Arabic text. The probe found the Arabic back in 3 of 3 runs.
Fix: wait for hydration before the rewrite, then call `settled(page)`. For example, `await page.locator("next-route-announcer").waitFor({ state: "attached" })`; in the probe that element appeared only after hydration. Cost: 15 min.

**3. Step 6 behaviors that no test checks.**
- src/modules/identity/server/two-factor.ts:52-58 derives "remember this device" for a code sign-in from Better Auth's internal session length: one day, or 90 days. No test signs in with a code and then reads `remembered`; the remembered-device e2e test uses a non-admin (e2e/auth.spec.ts:112). Once Renovate is installed, renovate.json:15-20 merges Better Auth's minor and patch updates on its own (ADR-0006).
- No test asserts the events `session.signOut`, `account.startTwoFactorSetup` and `account.enableTwoFactor`, or the code sign-in's `session.signIn` (searched in tests/ and e2e/).
- Removing the admins' two-factor requirement (src/modules/access/server/viewer.ts:26-27) passes every unit and integration test.
- Removing the unknown account's `hashPassword` (sign-in.ts:142) passes every test.

Fix:
- Add integration tests for `verifySignInCode` with "remember this device" on and off, checking `remembered` and the `twoFactor` diff of the audit event.
- Add integration tests for both two-factor setup steps and for `signOut`, checking their events.
- Add a unit test for the `needsTwoFactorSetup` flag of `getViewer`.

Cost: about 1 h.

**4. `/design` answers refusals with 200, not "the same answer as an address that does not exist".**
ADR-0009 #11 (line 24) makes that claim, but on a laptop the probe got `200` for both refusals: a streamed redirect when signed out, and a streamed not-found for the demo trainer. Only `/no-such-page` answers `404`. The page refuses after `loading.tsx` has streamed (src/app/design/page.tsx:73-77), which is the case the Step 5 note at docs/PLAN.md:590 warns about. The page exists only on laptops, so the status hardly matters.
Fix: correct ADR-0009 #11, or answer a request without a session cookie with the proxy's 404. Cost: 10 min.

**5. Open findings live only in merged PR bodies, and an ADR is past its deadline.**
Two open findings appear in neither docs/PLAN.md nor docs/BACKLOG.md, the files `/step` and `/audit` read:
- PR #7's JavaScript budget (major 1).
- PR #6's "e2e:screens at 390 px … 1170 px wide … Decide in the UX review".

ADR-0007 is still "proposed", although its status line asks the owner to choose "before Step 5 measures the Lighthouse targets".
Fix: add both findings to docs/BACKLOG.md, and the budget also as a note under Step 40. Ask the owner to accept ADR-0007, or to choose its cached alternative, before Step 7 builds `setSetting`. Cost: 15 min.

**6. Local `e2e:screens` captures are not what the UX review needs.**
On a laptop the captures run on `pnpm dev` (playwright.config.ts:14-16), so every capture shows the Next.js dev-tools button. It sits at the bottom left of the 390 px and 1440 px captures I viewed. The 390 px files are also 1170 px wide.
Fix: set `devIndicators: false` in next.config.ts, or capture against the standalone build. Settle the 390 px scale (`scale: "css"`) before `/ux-review 1-10`. Cost: 10 min.

**7. Two component sets for the same jobs.**
The BeUI pieces from Steps 5 and 6 replaced Step 4 primitives in use, and the primitives remain:

| Job | Step 4 primitive | BeUI piece |
| --- | --- | --- |
| Text field | `ui/input` | `motion/input` |
| Checkbox | `ui/checkbox` | `motion/checkbox` |
| Command palette | `ui/command` (cmdk) | `motion/command-palette` |
| Sheet | `ui/sheet` and `ui/drawer` (vaul) | `motion/bottom-sheet` |
| Menu | `ui/dropdown-menu` | `motion/bloom-menu` |

Outside `/design`, nothing imports the Step 4 primitive of any of these pairs. The backlog item at docs/BACKLOG.md:19 covers only sheets and toasts. docs/design/beui-map.md plans more pairs for Step 7: switch, select, tabs and popover.
Fix: in docs/design/beui-map.md, record which component is canonical for each job, so that Step 7 starts from one. Extend the backlog item to every pair, so that the UX review of Steps 1 to 10 removes each losing component and its dependency (cmdk, vaul). Cost: 15 min now.

**8. The CI job that commits baselines writes to pull request branches, and its CodeQL alert is still open.**
The `baselines` job (`.github/workflows/ci.yml:116-164`, 49 lines) has `contents: write` and pushes new PNGs to the pull request's branch. PR #7 lists its CodeQL alert as still open with the owner. The "Done when" needs only that the baselines exist, and a failing run already uploads them as the `visual-baselines` artifact (ci.yml:102-114).
Fix: drop the job and commit the artifact by hand (`gh run download <run> -n visual-baselines`), or dismiss the alert with a written reason. Cost: 15 min.

**9. The sign-in pages have no loading state.**
`src/app/(auth)/` has `error.tsx` but no `loading.tsx`. The account menu's "change password" (src/app/(app)/_shell/account-menu.tsx:53-56) is a client navigation into `(auth)`, and it shows nothing until the server answers. CLAUDE.md:19 asks for a loading state on every screen.
Fix: add `src/app/(auth)/loading.tsx`, shaped like the form card. Cost: 15 min.

**10. The demo admin's password and authenticator secret are public, and Step 41, which runs next, puts demo mode behind a public tunnel.**
db/seed/demo/accounts.ts:14 and :18 publish both in this public repository, which ADR-0009 accepts for demo data. Step 41 adds `pnpm local:up --demo` and `pnpm local:share` (docs/PLAN.md:666-668), and Step 26's owner check uses that tunnel on cellular (docs/PLAN.md:1067). Anyone who finds the tunnel's address can then sign in as the demo admin.
Fix, as a note under Step 41: in demo mode, generate the demo password and TOTP secret into the local `.env`, and let the smoke test read them from there. Keep the published values for CI and `APP_ENV=local` only. Cost: about 30 min, within Step 41.

**11. The two-factor lockout is an undocumented library default, and it writes no audit event.**
Better Auth allows 5 codes per challenge and locks two-factor for 15 minutes after 10 wrong codes in a row (verify-two-factor.mjs:121-122, totp/index.mjs:185). The password lockout comes from settings and writes `account.lock`. The two-factor lock is not a setting, ADR-0009 does not mention it, and it writes no event: `verifySignInCode` returns `locked` (two-factor.ts:48) and nothing more.
Fix: record the limits in ADR-0009. Write one audit event per lock the first time a code finds two-factor locked, and add it to the event list in the note under Step 11. Cost: 30 min.

## Enhancements (at most 3)

1. **Serve the identity font as WOFF2.** The two TTF files are 163 and 161 KB, 76.5 KB each gzipped. They make up 152 KiB of the login page's transfer.
   - Benefit: WOFF2 usually takes an Arabic TTF well below its gzipped size, which saves tens of kilobytes on every first visit over slow 4G. The swap also comes sooner, and Today's LCP (1.76-1.95 s here) is close to the 2.0 s bar.
   - Cost: about 1 h. Convert the files in `identity:sync` at build time (for example with the `wawoff2` package), hash-check the output, and point `next/font/local` at the `.woff2` files. identity-font.spec.ts already proves the result renders and joins.
2. **Read the college and its settings once per request.**
   - Today the college row is read separately by src/i18n/locale.ts, src/components/pilot-banner.tsx and src/app/(app)/layout.tsx.
   - `/today` then runs eight `getSetting` queries, one per key: language, time zone, banner, banner text, navigation order and three session limits. `getSetting` has no cache (src/modules/settings/server/get-setting.ts:11-29).

   Two changes cut this to two queries per request: wrap `findCollege` in React's `cache()`, and let `getSetting` pick from one cached read of all the college's stored settings.
   - Benefit: fewer database round trips on every page, toward section 4's p95 of 300 ms for reads. It also starts the per-request `getSetting` cache that Step 7 plans.
   - Cost: about 45 min, plus a test that one request reads the settings table once.
3. **Store the Step 6 login settings in `seed:demo`.** Step 4 stores `locale.language` so that "the app and its tests read stored values" (db/seed/demo/settings.ts:9). Add the demo college's own `pilot.bannerText` and a `platform.name`.
   - Benefit: demonstrations and the end-to-end smoke exercise the stored-value path of the login page and the pilot banner, and Step 7's settings screen opens on real values.
   - Cost: 15 min, plus the expected rows in tests/integration/seed-demo.test.ts.

## Resolution (review/audit-06)

- Branch `review/audit-06` from `main` at `7e4184d`, 2026-10-21. The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor finding gets a disposition here. The cheap ones that make a "Done when" claim or a CLAUDE.md rule hold were fixed. The others go where a later session reads them: a note under the affected step in `docs/PLAN.md`, or `docs/BACKLOG.md` for lead review A.
- One more finding came from outside the audit. While capturing the Step 6 screens for the progress page, a long email ran under the identifier's icon.
- A second pass reviewed the first round of fixes. "Second pass" below lists what it found; the table shows the final state.
- Commits are named by title. The squash-merge to `main` is titled `audit: steps 4-6`. Some intermediate commits fail tests on their own (the second pass ran them), so only the squashed tree counts.
- `seed:demo` is unchanged: its demo accounts work with the new lockout as they are.

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: the script budget | **Partly fixed; the budget itself is the owner's.** Sonner's toaster mounts only on `/design`, where toasts show, so every other page loads about 10.6 KiB less: `/` 246.6 KiB, `/today` 248.0 KiB. `lighthouserc.json` warns above 170 KiB (`resource-summary:script:size`). ADR-0010 (proposed) recommends a measured budget of 250 KiB per route, asserted as an error from Step 40, and section 4's line points to it. A note under Step 40 also asks Step 40 to keep Motion off the routes that do not animate. The shell's end-to-end test now checks that `/today` has no toast region. | `perf: mount the toaster only on the design catalog, and warn on script size`; `test(e2e): the shell carries no toaster until a screen shows toasts`; `docs: hand the deferred audit 2 items …` |
| Major 2: the lockout tells which accounts exist | **Fixed, more widely than proposed.** The proposed fix, counting unknown identifiers for a while, still told the two apart: an account's count never lapsed, so four wrong passwords, a wait and one more locked only real accounts. The first round put accounts and typed identifiers on one code path in `sign_in_lockouts`. The second pass then found that keying an account's lock on the account linked its two identifiers (second-pass major 1). Attempts now count against what was typed, for everyone. Each attempt is counted before its password is checked, and the attempt that reaches the threshold starts the lock. Five attempts within 15 minutes of the first lock that identifier for 15 minutes, from any address. Migration `0003` drops `users.failed_sign_ins` and `users.locked_until`. A sign-in or a reset clears both of an account's identifiers. ADR-0009 #3 and the Step 10 note follow. | `fix(identity): lock what was typed with no account as an account locks`; `fix(identity): count sign-in attempts per typed identifier, before checking them` |
| Major 3: two-factor codes in Arabic-Indic digits | **Fixed.** Both code fields go through `latinDigits()`; `src/app/(auth)/actions.test.ts` fails without it. | `fix(auth): read two-factor codes typed in Arabic-Indic digits` |
| Extra: typed text ran under a field's icons | **Fixed.** `dir="auto"` turned a field's own direction to left to right once an email or a Latin password was typed, so its logical padding swapped sides. The motion input now takes no `dir`: its padding and icons follow the page, and its text takes its direction from what is typed (`unicode-bidi: plaintext`, which the HTML rendering rules use for `dir=auto` text fields). The end-to-end test measures each field's text box against its icons and the show-password button. It fails without the fix on desktop and iPhone. | `fix(ui): keep typed text clear of a field's icons`; `test(e2e): axe waits for every boundary to hydrate; …` |
| Minor 1: the Lighthouse gate takes the best of three | **Note under Step 40.** Assert the median after a warm-up run, or record the choice in ADR-0001. | `docs: hand the deferred audit 2 items …` |
| Minor 2: axe ran before hydration | **Fixed.** The helper waits until React owns every element of `main`, which covers the Suspense boundaries React hydrates in a later pass, and fails if Arabic text comes back. Without any wait, two axe tests fail that check. | `test(e2e): run axe on the hydrated page, …`; `test(e2e): axe waits for every boundary to hydrate; …` |
| Minor 3: untested Step 6 behaviors | **Fixed.** Integration tests cover two-factor setup and its two events, a code sign-in (remembering the device only when asked) and a backup code with their events, sign-out and its event, and the hash for an unknown identifier. `viewer.test.ts` covers the admins' two-factor rule. The RFC 6238 helpers moved to `tests/support/totp.ts`. | `test(auth): cover two-factor sign-in and setup, sign-out and the admin rule` |
| Minor 4: `/design` answers 200 | **ADR-0009 #11 corrected** to say what a laptop gets. | `docs: hand the deferred audit 2 items …` |
| Minor 5: findings left in PR bodies; ADR-0007 overdue | **The budget is now ADR-0010 with a Step 40 note, and PR #6's 390 px question is in `docs/BACKLOG.md`. ADR-0007 goes to the owner** (checklist below). | `docs: hand the deferred audit 2 items …` |
| Minor 6: `e2e:screens` captures | **`docs/BACKLOG.md`**, before `/ux-review 1-10`. | `docs: hand the deferred audit 2 items …` |
| Minor 7: two component sets | **`docs/design/beui-map.md` names one component per job**, and the backlog item now covers every pair for the UX review of Steps 1 to 10. | `docs: hand the deferred audit 2 items …` |
| Minor 8: the baselines job | **`docs/BACKLOG.md`; the CodeQL alert stays with the owner.** | `docs: hand the deferred audit 2 items …` |
| Minor 9: no loading state on the sign-in pages | **Fixed.** `src/app/(auth)/loading.tsx` is shaped like the form. `tests/unit/loading-states.test.ts` fails when a page under `src/app` has no `loading.tsx` above it; without the new file it lists the four sign-in pages. Lighthouse afterwards: `/` LCP 1.72-1.73 s, CLS 0.002. | `feat(auth): a loading state for the sign-in pages` |
| Minor 10: the demo secrets behind Step 41's tunnel | **Note under Step 41.** | `docs: hand the deferred audit 2 items …` |
| Minor 11: the two-factor lock | **ADR-0009 consequences name its limits; a note under Step 11 adds its event.** | `docs: hand the deferred audit 2 items …` |
| Enhancement 1: WOFF2 | **`docs/BACKLOG.md`**, once the font licence allows converting the files (ADR-0004). | `docs: hand the deferred audit 2 items …` |
| Enhancement 2: settings once per request | **Note under Step 7**, whose per-request `getSetting` cache this is. | `docs: hand the deferred audit 2 items …` |
| Enhancement 3: the demo college's login settings | **Note under Step 7**, with its seeded defaults. The `/design` baselines show the pilot banner, so they change with its text. | `docs: hand the deferred audit 2 items …` |
| Plan rules: the auth actions in Step 9's matrix; `account.create` in Step 10 | **Notes under Steps 9 and 10.** | `docs: hand the deferred audit 2 items …` |

### Second pass

A review of the first round of fixes (at `b6de258`) found the following. It ran its probes outside the repository.

| Finding | Fix |
| --- | --- |
| Major: the lock was keyed on the account, so locking a person's email also locked their employee number. One request per candidate number then told which number belonged to a guessable email | Attempts count against what was typed, for everyone, and the per-address limit follows the same key. An account's two identifiers count apart, as two identifiers with no account do; a sign-in or a reset clears both. The cost: someone guessing a password gets twice the attempts per window (ten every 15 minutes by default; ADR-0009 consequences). New test: "counts an account's email and employee number apart, …", which fails on `b6de258` |
| Minor: attempts checked the lock, then the password, then counted, so attempts that raced each other were all checked past the threshold (16 at once wrote 12 lock events). Not a regression | Each attempt is counted in one statement before its password is checked. The attempt that reaches the threshold starts the lock and writes the one event; later attempts are refused unchecked. New test: 12 racing attempts give 4 `invalid`, 8 `locked` and one `account.lock` (8 on `b6de258`) |
| Minor: the unknown path takes about 2.5 ms less (Better Auth's lookups and log line) | Not equalized. The lockout leaves five timed attempts per identifier in each window, too few to tell a few milliseconds apart through a network. ADR-0009 #3 says "about as long" and why |
| Minor: the axe wait covered the router root, not the Suspense boundaries under `loading.tsx` | The helper waits until React owns every element of `main`, except the hidden fields of a server-action form |
| Minor: the icon test measured the show-password button's icon, not the button | It measures the button; with `dir="auto"` back on the password field alone, it fails |
| Docs: ADR-0010's arithmetic, "in a row", the window "within N minutes of the first", the bloom menu's step, the changelog's claims | Corrected. The changelog's axe line now matches the helper |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 · `Checked 257 files … No fixes applied.` · `Test Files  54 passed (54)` · `Tests  296 passed (296)` · `check:hardcode passed.` · `✔ no dependency violations found (236 modules, 709 dependencies cruised)` |
| `pnpm check:unused` · `pnpm db:generate` | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm exec playwright test --config playwright.local.config.ts --project setup --project desktop --project iphone` (dev server; the local config only points at the container's Chromium) | `138 passed (3.8m)` · `12 skipped`, all by design |
| `pnpm lighthouse` on the standalone build (after the toaster move and the loading state) | `/`: performance 0.97, 0.96, 0.98 · LCP 1729, 1728, 1716 ms · CLS 0.002. `/today`: 0.98, 0.99, 0.99 · LCP 1499, 1553, 1573 ms. Accessibility and best practices 1 everywhere. Script transfer: 252,550 and 253,988 bytes, a warning above 174,080 |
| The new lockout tests on the previous head (`b6de258`, in a scratch worktree) | `Tests  2 failed \| 20 passed (22)`: the two identifiers answered `locked` for the account's number, and the race wrote 8 `account.lock` events |

**Mutation checks.** I backed up each file, applied the mutation, ran only the named tests, then restored the file and checked its sha256.

| Mutation | Result |
| --- | --- |
| Unknown identifiers answer `invalid` without counting | "answers what was typed with no account exactly as an account, …" fails |
| Counts never lapse (no delete of ended rows) | three lockout tests fail, among them "counts wrong passwords for the lockout's minutes, …" |
| A sign-in clears only what was typed | "… and a sign-in clears both" fails |
| A reset leaves the locks | the resetPassword test fails |
| Attempts past the threshold are checked | three tests fail, among them "counts attempts that race each other …" |
| The two code fields without `latinDigits()` | actions.test.ts fails (first round) |
| `requireViewer` never sends an admin to set up two-factor | viewer.test.ts fails |
| A code sign-in never marks the device remembered | "signs in with the app's code, remembers the device only when …" fails |
| Setup start or sign-out writes another action | their tests fail |
| An unknown identifier is not hashed | "answers alike for an unknown account and a wrong password" fails |
| `dir="auto"` back on the sign-in fields | the icon test fails on desktop and iPhone; on the password field alone it fails too |
| No hydration wait in the axe helper | two axe tests fail: "Arabic text … came back" |
| No `(auth)/loading.tsx` | loading-states.test.ts lists the four sign-in pages |

### Known limits

- Someone guessing a password gets ten attempts per account in each 15 minutes: five through the email and five through the employee number. Counting them together would link the two identifiers again.
- An unknown identifier takes a few milliseconds less than a wrong password (ADR-0009 #3).
- `lighthouserc.json` only warns on the script budget until the owner accepts ADR-0010 and Step 40 makes it an error.

### Hand-off

- **docs/PLAN.md:** notes from Audit 2 under Steps 7, 9, 10, 11, 40 and 41, and section 4's budget line points to ADR-0010.
- **docs/BACKLOG.md:** one component per job, the `e2e:screens` captures, the baselines job, WOFF2 after the licence, and digits in passwords. The last four are listed for lead review A.

### You: owner checklist

- [ ] ADR-0010: accept the measured script budget (250 KiB per route), or choose option A or C, before Step 40.
- [ ] ADR-0007 is still "proposed": accept the per-request locale read, or choose the cached alternative, before Step 7 builds `setSetting`.
- [ ] The CodeQL alert on the `baselines` job: dismiss it with a written reason, or ask for the job to be dropped (docs/BACKLOG.md).
- [ ] Still open from Audit 1: protect `main` (the ruleset checklist in docs/reviews/audit-03.md) and install Renovate.
