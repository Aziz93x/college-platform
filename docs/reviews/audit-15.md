# Audit 5: steps 13-15

- Range, in run order:
  - Step 13 `459c921 feat: terms and calendar, with the Eid breaks ten years ahead (step 13)` (PR #32).
  - `3aa6d2f change: Founding Day, each year's holidays in their year, approved or adjusted (ADR-0018 amended)` (PR #33), the owner's amendment to Step 13's holidays, read with Step 13.
  - Step 14 `6a7ef8e feat: portfolio axes catalog (step 14)` (PR #35).
  - Step 15 `6e89591 feat(framework): the term's general framework, drafted, endorsed where asked, published as versions (Step 15)` (PR #36, not merged).
  - Out of range: `d905a6c` and `51e2b49` (announcements, ADR-0017).
- Audited on `step/15-framework` at `6e89591`, a clean tree, on 2026-10-22, by the auditor agent with the karpathy-guidelines skill.
- This audit does not touch GitHub, so it did not read the pull requests. Stated assumptions are judged from the commit bodies, CHANGELOG.md, ADR-0018, docs/reviews/eid-breaks.md, the plan's notes and the code's comments.
- Left out as known: the provisional axis titles, the flaky history test in e2e/audit.spec.ts, and the uncommitted e2e/dev.local.config.ts.
- Verdict: **no blockers, 3 major, 9 minor.**
  - `pnpm check:all` passes with 705 tests. The three steps' end-to-end specs pass, 16 tests on desktop and iPhone.
  - Every Done when has a test, and 12 of 16 mutations fail one. Four fail none: the wizard's framework copy, which is a Done when, and three guards.
  - **Major 1.** The trainer's term test fails whenever today falls in a week that an Eid break fills: 28 days in 2027, starting 28 February. The holiday-approval test also fails on Thursdays from 21:00 to 24:00 UTC.
  - **Major 2.** The term page's weeks repeat Audit 4's contrast fault. Muted text measures 4.18:1 on this week's tint and 3.97:1 on a holiday week's. Audit 4 wrote the rule against this into the token test.
  - **Major 3.** An evidence policy's file types come from a closed list in code: pdf, image, word, excel and powerpoint. The college's `files.acceptedTypes` setting, which the plan made data, sits beside it, and nothing links the two. Step 15's own plan note tells Step 18 to reuse the shape.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 2 m 42 s · `Checked 555 files in 1095ms. No fixes applied.` · `Test Files  97 passed (97)` · `Tests  705 passed (705)` · `check:hardcode passed.` · `✔ no dependency violations found (482 modules, 2094 dependencies cruised)` |
| `pnpm check:unused` · `drizzle-kit generate` (on a scratch copy of HEAD) | knip exit 0 · `No schema changes, nothing to migrate` |
| `pnpm build`, then `.next/static` and `public` copied into `.next/standalone` as CI does | exit 0 · `✓ Compiled successfully in 8.1s` · `✓ Generating static pages using 3 workers (35/35) in 818ms` |
| Fresh database: drop and create `college`, then `pnpm db:migrate && pnpm db:seed && pnpm seed:demo` | `seed:demo finished with --seed 42 --week 9: college 01a1635f-…` in 17.1 s |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts e2e/terms.spec.ts e2e/axes.spec.ts e2e/framework.spec.ts --grep-invert @visual` (the standalone build) | `Running 16 tests using 2 workers` · `16 passed (53.0s)`. The server printed no warning |

**Probes.** These ran on the production build, on throwaway databases (`audit15_clock`, since dropped), or as integration tests in the scratch copy. Everything they need is in the scratchpad.

| Probe | Result |
| --- | --- |
| P1: today in a week an Eid break fills. A college holiday from 2026-10-16 to 2026-10-24 covers this week's working days, as an Eid break does, before `seed:demo` (week 9). The term starts 2026-08-23, and this week is its holiday week. Then terms.spec.ts:290 | Fails on desktop and iPhone, and again on retry: `Error: strict mode violation: getByText(/^(الأسبوع 9 من 18\|أسبوع إجازة)$/) resolved to 2 elements: 1) <span …>أسبوع إجازة</span> aka getByRole('button', { name: 'الفصل التدريبي: الفصل التدريبي الأول 1448، أسبوع إجازة. تغيير الفصل' }) 2) <span class="inline-block">أسبوع إجازة</span> aka locator('#main')…` (major 1). Moving the processes' clock four months ahead with a preload did not work: the trainer landed on the login page, so I built the same state from data instead |
| P1b: the holiday weeks that the base seed's estimates make for the demo college (Sunday to Saturday, five working days) | `2027-02-28..2027-03-06` · `2027-03-07..2027-03-13` · `2027-05-09..2027-05-15` · `2027-05-16..2027-05-22` · `2028-02-13..2028-03-04` (3 weeks) · `2028-04-30..2028-05-13` |
| P2: the throwaway college's time zone set to `Pacific/Kiritimati`, where it was already Friday 01:35 while it was Thursday 11:35 UTC. Then terms.spec.ts:219 | Fails on desktop and iPhone, and on retry: `Test timeout of 30000ms exceeded. Error: locator.click: Test ended. … getByRole('button', { name: 'اعتماد إجازة الاختبار 664141 1448 هـ' })` (major 1) |
| C1: axe on the term page as the demo trainer, after `seed:demo --week 8` (the midterm week). A second run added a college holiday that fills one week of the term | `color-contrast`, serious, desktop and iPhone: `li[aria-current="date"] > .basis-full…text-xs: fg #737778 bg #f5f6f8 ratio 4.18 size 9.0pt (12px)`. With the holiday week: `.bg-muted\/40 > .basis-full…text-xs: fg #737778 bg #f0f0f0 ratio 3.97` (major 2) |
| P3: a draft framework started while its term was active, then the term closed | `P3 term closed · startDraft: closed · addItem: saved · publishDraft: published` (minor 2) |
| P4: a term from 2027-01-10, 18 weeks, finals 2027-06-06..06-10. Eid al-Adha 1448 then adjusted to 11 days, as 1447's was | `estimate 2027-05-07..2027-05-22 · term's last day 2027-06-12 · Finals … added: saved · updateHoliday to 2027-05-12..2027-05-22: saved · term's last day now 2027-06-05 · rename: {"status":"eventsOutside","events":["Finals"]} · add a meeting in week 1: {"status":"eventsOutside","events":["Finals"]}` (minor 1) |
| P5: `countTasks()` on a term whose exams end in weeks 8 and 18 | `exams end in weeks 8 and 18 of 18 · "1 week after each exam" counts 2 for one trainer (due in weeks 9 and 19) · "week 19" counts 0` (minor 3) |
| P6: one person given a role in a department for every term and for the active term | `every term: added · this term: added · countMembers for the one person: [2]` (minor 4) |
| P7: the item actions' schema (`frameworkItemInput`) | `takes an unknown role id and the calendar kind "anything": true · addItem: saved` (minor 6) |
| D1: the fresh demo seed's term-limited membership | `سلطان الغامدي \| 200015 \| secretary \| الكهربائية \| (every term)` and `… \| secretary \| الكهربائية \| الفصل التدريبي الأول 1448`. Electrical's secretaries: `memberships 2 · people 1` (minor 4) |

**Mutation checks.** I applied each change to a scratch copy of HEAD (made with `git archive`), ran the named tests there, then restored the file and checked it against HEAD. For M1, M13, M14 and M16 I ran the whole suite. That suite always reports `Tests  2 failed | 703 passed (705)` in the copy, because tests/unit/licensed-assets.test.ts needs a git checkout. "No test fails" below means nothing failed beyond those two.

| Mutation | Result |
| --- | --- |
| M1: `openNextTermAction` without the framework copy (`src/app/(app)/terms/actions.ts:96`) | **no test fails** (minor 5) |
| M2: `draftOf` also returns a published version (framework.ts:178) | 3 framework.test.ts tests fail, "starts as an empty draft, takes items, and publishes a version that changes no more" among them |
| M3: publishing ignores the endorsement (framework.ts:330) | "waits for the dean's endorsement where the college asks for it, and a change takes it back" fails |
| M4: a change to the draft keeps the endorsement (framework.ts:185) | the same test fails |
| M5: a one-term role gives its keys whatever its term's status (load-access.ts:36) | terms.test.ts "gives its keys only while its term is the active one" fails |
| M6: no week is ever skipped (weeks.ts:58) | weeks.test.ts: 5 of 9 fail |
| M7: a calendar change that leaves an event outside its term is saved (terms.ts:361) | "refuses an event outside the term, and a change that leaves one outside it" fails |
| M8: a holiday that has begun can still be adjusted (server/holidays.ts:88) | "are adjusted by the vice-dean, for every term at once, until they begin" fails |
| M9: the wizard also copies the holidays (terms.ts:502) | "keeps one active term per college, opens the next term from a term's calendar, …" fails |
| M10: `updateAxisAction` takes `term.manage` | the matrix's "updateAxisAction runs for exactly the roles that hold axes.manage across the college, or where its person is" fails |
| M11: a week rule also counts past the term (count.ts:19) | count.test.ts `counts {"type":"week","week":19} 0 times in 18 weeks` fails |
| M12: `countMembers` counts disabled accounts | "counts the enabled holders of each role in each active department" fails |
| M13: the switcher lists drafts to everyone (`_shell/term.ts:16`) | **no test fails** (minor 5) |
| M14: a term's page shows a draft to everyone (`terms/[id]/page.tsx:54`) | **no test fails** (minor 5) |
| M15: Founding Day stays on the weekend (domain/holidays.ts:109) | holidays.test.ts "keeps Founding Day … moved off the weekend as the official rule says" fails |
| M16: `startDraft` opens a draft for a closed term (framework.ts:139) | **no test fails** (minor 2) |

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 13 | Unit tests cover week calculations across Ramadan and Eid breaks | proven | weeks.test.ts runs the second term of 1447: trained through Ramadan, with two Eid breaks and Founding Day. M6 fails 5 of its 9 tests |
| 13 | The vice-dean creates an 18-week term with holidays on the screen, and the wizard creates the next term from it (integration test) | proven | terms.test.ts:150 and `:299`; on the screen, e2e terms.spec.ts:107 on desktop and iPhone. M7 and M9 fail terms.test.ts |
| 13, ADR-0018 | Breaks estimated for ten years, approved or adjusted until they begin | proven | holidays.test.ts, against the table in docs/reviews/eid-breaks.md; terms.test.ts:553-705; terms.spec.ts:219. M8 and M15 fail tests. See major 1 (the e2e's clock) and minor 1 (events left outside a term) |
| 14 | The seed loads the axes | proven | seed-base.test.ts:64. A fresh seed has 4 groups and 13 axes |
| 14 | A vice-dean cannot rename a locked axis (test) | proven | The matrix's row for `updateAxisAction` passes only `axes.manage`, which the vice-dean lacks; M10 fails it. axes.spec.ts:78 refuses the page to a trainer. Every axis counts as locked, so no `locked` column is stored (a stated choice) |
| 15 | The impact preview comes from one shared, unit-tested counting function that the Step 20 engine reuses | proven, one rule open | count.test.ts; `src/app/(app)/framework/page.tsx:166` calls `countTasks()`. M11 fails count.test.ts. See minor 3 |
| 15 | Publishing creates an immutable version | proven in the module | framework.test.ts:92 and `:163`; M2 fails 3 tests. The module's functions refuse to change a published version. The table itself does not, but every writer goes through `draftOf`; no finding |
| 15 | The Step 13 wizard copies the framework as a draft | partly proven | framework.test.ts:207 passes `copyFrameworkInto` to `openNextTerm()` itself. The wizard's action can lose it with no test failing (M1, minor 5) |

**Plan rules.**

- **Hardcoded values.**
  - `check:hardcode` passes, and no role key appears in `src/` outside tests.
  - How weeks are counted is settings: `calendar.workingDays` (5), `calendar.skipHolidayWeeks` (on) and `calendar.termWeeks` (18), on top of `locale.weekStart`.
  - The holidays' names and averages are data in db/seed/base.ts, and so are the axes and their groups.
  - The numbers left in code are guards: `termLimits` (120, 52), `axisLimits` (120, 500) and `frameworkLimits` (200, 1000, 52, 20).
  - The exception is the evidence policy's file types (major 3).
- **Permissions by key.**
  - The range uses `term.manage`, `axes.manage`, `framework.publish` and `framework.endorse`.
  - The dean gets `framework.endorse` in the base seed and, for colleges that already exist, through migration 0016, as Audit 3 asked.
  - `term.manage` now edits settings without requiring two-factor (minor 8).
- **Server actions.**
  - The range adds 16: 9 for terms, 1 for axes and 6 for the framework. `addMembershipAction` now also takes a term.
  - Each goes through `viewerAction`, with a Zod schema and a key in its metadata, and each has its row in the permission matrix and its line in actions-audit.test.ts.
  - Two fields of the item schema are loose (minor 6).
- **Audit events.** Each change writes its event in the same transaction:
  - `term.create`, `term.update`, `term.activate` and `term.close`;
  - `calendarEvent.create`, `.update` and `.delete`;
  - `holiday.update` and `holiday.approve`;
  - `axis.update`;
  - `framework.create`, `frameworkItem.create`, `.update` and `.delete`, `framework.endorse` and `framework.publish`;
  - `membership.create` with its term.

  The log names each of them (describe.ts, with its tests).
- **Screen states.**
  - `/terms`: loading, an empty state with "add", the refusal, and the holidays' own empty line.
  - `/terms/new`: loading and the refusal.
  - A term's page: loading, and not found for another college's term or for a draft shown to someone who does not manage terms. It has an empty-calendar line, and its controls follow the key.
  - `/axes`: loading, empty and the refusal.
  - `/framework`: loading, "no term", nothing published, and the empty state for the vice-dean. A draft shown beside the published version is its partial state. Everyone may read it.
  - The switcher appears only once there is a term, and Today's badge only inside the active term or before it starts.
  - Errors fall to the `(app)` error boundary.
  - Everything is right to left. 44 px targets are checked on the calendar, the axes and the framework draft. axe runs on `/terms`, `/axes` and the empty draft, but not on a term's page (major 2).
- **Demo data** (a fresh seed).
  - One active 18-week term from 2026-08-23, with today in week 9, and 6 calendar events the vice-dean entered.
  - 30 holidays for 1448-1457, none approved.
  - 13 axes, and a published framework of 10 items.
  - One term-only secretary, who is already the secretary for every term (minor 4).
  - 539 audit events. The seed takes 17.1 s.
  - The closed previous term belongs to Step 43. Other gaps: enhancement 2.
- **Isolated network.** Every end-to-end test fails on a request outside the app's origin, and all 16 passed. The production-image smoke runs none of the three new specs (minor 7).

## Karpathy guidelines

1. **Think before coding: mostly stated, with five silent choices.**
   - Most choices are written where a reader finds them:
     - **Step 13**, in CHANGELOG.md: weeks count from the first day, a week of holidays goes unnumbered while the setting says so, and the working days are a setting. A role held for one term gives its keys while that term is active. Only managers see drafts.
     - **Step 13**, elsewhere: the demo term's name is a guess at Rayat's wording (the note under Step 16). The owner's holidays have their ADR, with its sources and its amendment.
     - **Step 14:** no `locked` column, since every axis is the administration's (the note under Step 15). The titles are provisional. The closing group's optional marker is left to Step 31.
     - **Step 15:** an item reaches a role or each section. Sections count from Step 17. Endorsement is off by default, and a change takes it back. The dean's new key takes the dean out of the vice-dean's reach (CHANGELOG.md).
   - Five are silent:
     - the evidence types are kept beside the setting (major 3);
     - an "after an event" rule counts past the term, while a week rule does not (minor 3);
     - holders are counted by membership, not by person (minor 4);
     - an Eid adjustment's effect on a term's events (minor 1);
     - the end-to-end tests take today on UTC's clock, while the app takes Riyadh's (major 1).
   - Step 15's title says "(Step 15)" (minor 9).
2. **Simplicity: proportionate.**
   - **Step 13.** About 2,400 lines of pages and 1,100 of module code. They cover the list, the form, and a term's page with its lifecycle, calendar editor and weeks. They also cover the switcher, Today's badge, one-term roles, and ADR-0018's estimates with their approval. The week logic itself is 83 pure, unit-tested lines.
   - **Step 14.** About 540 lines, with one action.
   - **Step 15.** About 1,100 lines of pages and 700 of module code. Most of it is the item sheet (642 lines), with one control for each field the plan lists.
   - **Nothing speculative.**
     - `openNextTerm()`'s callback has one user today. The plan names Steps 18 and 19 as the next two, and importing the framework from the terms module would make a cycle.
     - `canonical()` (8 lines) lets an unchanged save write no event.
   - One defensive branch exists only because a schema is loose: `src/app/(app)/framework/page.tsx:105-108` (minor 6).
3. **Surgical changes: good.**
   - Each earlier file the range touches serves the range:
     - the membership's term, in the roles page, `addMembership` and `loadAccess`;
     - the settings' calendar group, and the settings item's second key;
     - the date picker's one-day mode, recorded in PROVENANCE.md;
     - the navigation lists in three end-to-end specs, and the dean in the reach test.
   - `deviceOf` moved to db/seed/demo/device.ts when it got a second user. The amendment's renames (`eidBreaks` to `holidayRules`) follow its wider scope.
   - knip and Biome are clean, and drizzle-kit finds no drift.
4. **Goal-driven: strong in the module code, weak where dates and screens meet.**
   - Every Done when has a test, and 12 of 16 mutations fail one.
   - The wizard's copy, wired in its action, and three guards fail nothing (minors 2 and 5).
   - The trainer's journey assumes that today falls in a numbered week (major 1), and no axe check sees the weeks' tints (major 2).

## Findings

### Blocker

None.

### Major

**1. Two end-to-end tests pass or fail by the calendar. The trainer's term test fails whenever today falls in a holiday week, and the holiday-approval test fails on Thursday nights.**

- **The trainer's test** (e2e/terms.spec.ts:290). It expects today to fall in week 9.
  - The test's comment allows "a week of an Eid break just before it" (`:299-300`), but two of its checks do not:
    - At `:301-307`, a holiday week makes Today's badge and the header's say the same words, "أسبوع إجازة" (`today.term.holiday`, `shell.term.holiday`), so `getByText` finds two elements.
    - At `:316-319`, the current row of the weeks then reads "إجازة", not "الأسبوع 9".
  - P1 built that state with one college holiday over this week, which is what an Eid break does, and the test failed on desktop and iPhone, on retry too (`strict mode violation: … resolved to 2 elements`).
- **When it fails.** With the base seed's estimates, today falls in a holiday week of the demo term (P1b, in Riyadh dates) from 28 February to 13 March and from 9 to 22 May 2027, then on 35 days in 2028. CI seeds the demo on the day it runs, so CI fails on each of those days, with no change to the code. This is the fault Audit 4's major 2 found in the notification tests.
- **The approval test** (`:219`). It takes today on UTC's clock at `:228` (and the Hijri year at `:27`), and puts its holiday on "the coming Friday". `/terms` takes today on the college's clock (`src/app/(app)/terms/page.tsx:58`) and marks a holiday `begun` from its first day (`:147`). A begun holiday's row has no buttons (`holiday-breaks.tsx:164`).
  - From 21:00 to 24:00 UTC on a Thursday, it is already Friday in Riyadh. P2 showed the same effect today with a college clock ahead of UTC: `locator.click: Test ended` at `:265`, on both devices.
- Both tests are the only checks of the header's term, Today's week, and approving a holiday.

Fix:
- **The trainer's test.**
  - Look for Today's badge inside `page.locator("main")`.
  - At `:319`, accept the same two states as the badge: `t("weeks.number", { number: 9 })` or `text.weeks.holiday`. Alternatively, read the week as tests/integration/seed-demo.test.ts:467-482 (`demoWeek`) does, and expect that.
- **The approval test.** Take today on the college's clock, `wallClock(new Date(), settingsRegistry["locale.timeZone"].default)`, as seed-demo.test.ts:474 does. Do it at `:27` and `:228`, and put the test's holiday on a Friday at least two days ahead.
- Run each test once in P1's state, which takes one insert before `seed:demo`.

Cost: 30 min.

**2. The term page's weeks fail contrast: 4.18:1 on this week, 3.97:1 on a holiday week. Audit 4 already fixed this fault once.**

- **Where.**
  - `src/app/(app)/terms/[id]/term-weeks.tsx:50-51` tints a holiday week `bg-muted/40` and this week `bg-primary/5`.
  - Each row's Hijri days (`:62`) and what the week holds (`:74`) stay `text-muted-foreground`, #737778.
- **Measured** (C1, axe as the demo trainer).
  - With `--week 8`, on desktop and iPhone: `fg #737778 bg #f5f6f8 ratio 4.18 size 9.0pt (12px)` at this week's row.
  - With a week the holidays fill: `fg #737778 bg #f0f0f0 ratio 3.97` at that week's row.
  - The same grey on the same tints fails for the Hijri days too, so every row with a tint fails while `locale.hijri` is on.
  - The `/terms` list's rows turn `hover:bg-muted/50` under the pointer (`src/app/(app)/terms/page.tsx:98`) and keep their muted days line. I computed 3.83:1 for that, as Audit 4 composed tints; axe does not hover.
- **When it shows.** This week's row fails whenever the week holds something; in the demo, that is the meeting, the midterms, the extra holiday, the finals and the grade deadline. A holiday week's row fails on every term that meets an Eid break: the second term of 1448 meets both.
- **Why nothing caught it.**
  - Audit 4 wrote the rule into tests/unit/identity-tokens.test.ts:94-96: "Muted text stays off them … so tinted rows and their hover use the foreground". The test checks only the pairs it lists, though: it has no `muted/40` tint and no pair with muted text (`:97-110`).
  - The demo's default week 9 holds nothing, and its term meets no Eid break.
  - terms.spec.ts runs axe on `/terms` only (`:132`), never on a term's page.

Fix:
- Make the tinted rows' secondary text `text-foreground`, as Audit 4 did for unread notifications, or drop both tints. The row already says "هذا الأسبوع" and "إجازة".
- On `/terms`, add `group-hover:text-foreground` to the days line, as `src/app/(app)/notifications/notification-list.tsx:123` does.
- Add `muted/40` to the token test's tints, with the pairs the rows use.
- In terms.spec.ts:107, run `seriousViolations(page)` once the holiday week is added. Its term then always shows a holiday row, whatever the date.

Cost: 30 min.

**3. An evidence policy's file types are a closed list in code, beside the setting the plan made for them, and nothing links the two.**

- **Where.**
  - `src/modules/framework/domain/inputs.ts:21-28` defines `evidenceTypes = ["pdf", "image", "word", "excel", "powerpoint"]`, "as the upload will check them".
  - `:70` takes a policy's `types` from that list.
  - `src/app/(app)/framework/page.tsx:216-218` offers it, with five messages (messages/ar.json:1815-1821).
- **The college's accepted types are data.**
  - Step 7 seeded them as "file size limit and accepted types" (docs/PLAN.md:698): `files.acceptedTypes` (registry.ts:305-321), with the default pdf, jpg, jpeg, png, heic, docx, xlsx and pptx.
  - The upload (Step 25) checks against that setting (registry.ts:296).
  - The setting has no reader yet, and nothing maps the five words to its extensions.
- **What follows.**
  - If an admin takes pptx off the setting, an item that requires "powerpoint" asks for something the upload will refuse, and a trainer cannot complete it.
  - If the college adds a type, such as mp4 for a practice video, no policy can ask for it.
  - "word" names no extension at all.
- **Against the plan.**
  - The rule is "Capabilities in code, everything else in data" (section 2), and the definition of done says "No domain value is written in code" (docs/PLAN.md:45).
  - Step 15's own note tells Step 18 to reuse `evidencePolicy` (docs/PLAN.md:1034), so the second list spreads to templates next, and Step 25 would need a third place to map them.
  - Neither CHANGELOG.md nor a plan note says that the policy's types are not the setting's.

Fix:
- Take a policy's types from the setting. The shape keeps a list of extensions.
- The two item actions refuse a type that `files.acceptedTypes` does not hold. They read the setting the way `publishDraftAction` reads its own.
- The sheet offers the setting's list, each written as its extension in capitals. Delete `evidenceTypes` and its five messages, and give the demo items extensions.
- If the owner wants categories instead (a phone's camera for "image"), record that in the notes for Steps 18 and 25, and derive each category's extensions from the setting in one place.

Cost: 45 min.

### Minor

**1. Adjusting an Eid break can leave a term's final exams outside the term. The term then refuses unrelated changes.**
- **Where.** `updateHoliday` (src/modules/terms/server/holidays.ts:67-144) checks only the holiday itself (`:88`, `:90`).
- **The rule.** Step 13 refuses "a change that would leave a calendar event outside its term" (CHANGELOG.md), in `updateTerm` and in every calendar change through `outside()`. An adjustment that shortens a term's holidays shortens the term, and nothing checks the term's events against it.
- **Probe P4.** An 11-day Eid al-Adha, as 1447's was, is `saved`. The term's last day moves from 2027-06-12 to 2027-06-05, which leaves its finals (2027-06-06..06-10) outside the term. Renaming the term then returns `{"status":"eventsOutside","events":["Finals"]}`, and so does adding a meeting in week 1.
- **Why it matters.** Every term ends with its finals and its grade deadline, as the demo's does, and the vice-dean adjusts or approves each break once it is announced.

Fix: before writing, run `outside()` on each term that is not closed and that the old or new days touch. Refuse with `eventsOutside`, naming the term and its events, and show that in the sheet as the term form does. Add P4's sequence as a test. Cost: 40 min.

**2. A closed term's draft framework still takes items and is still published.**
- **Where.**
  - `startDraft` refuses a closed term (src/modules/framework/server/framework.ts:139).
  - `draftOf` (`:166-178`) never looks at the term, and `addItem`, `updateItem`, `removeItem`, `endorseDraft` and `publishDraft` all go through it.
- **Probe P3.** A draft started while its term was active, then the term closed: `startDraft: closed · addItem: saved · publishDraft: published`.
- **Also.**
  - The page offers that draft's controls to anyone who holds `framework.publish` (page.tsx:169).
  - Removing the check at `:139` fails no test (M16).
  - Once Step 20 generates tasks from a published framework, this publish would add work to a closed term.

Fix: join `terms` in `draftOf` and refuse `closed` there, so every change and the publication check the term. Add P3's sequence as a test. Cost: 20 min.

**3. The counting function counts an "after an event" task past the term's last week, while a week task past it counts nothing.**
- **Where.** `occurrences()` (src/modules/framework/domain/count.ts:18-25): week 19 of an 18-week term counts 0 (`:19`), but an `afterEvent` rule counts every event of its kind, whatever week the task falls due (`:25`).
- **Probe P5.** With exams ending in weeks 8 and 18, "1 week after each exam" counts 2, due in weeks 9 and 19.
- **The demo.** The demo framework's "تحليل نتائج الاختبار" (db/seed/demo/framework.ts:52-65) is exactly this: its finals end in week 18.
- **The note.** The Step 20 note this step wrote (docs/PLAN.md:1058) tells the engine to generate "exactly those", which means a task due after the term ends.

Fix: decide the rule and record it in that note. The simplest consistent one counts only due weeks inside the term. `TermShape.events` then carries each event's last numbered week instead of a count per kind, and an event counts when `week + due.weeks <= term.weeks`. Add P5 to count.test.ts. Cost: 30 min.

**4. `countMembers` counts memberships, not people, and the demo's one-term secretary already holds the role for every term.**
- **Where.** `src/modules/access/server/members.ts:15` uses `count()`.
- **Why it double-counts.** A person may hold a role in a department both for every term and for one term, because `memberships_scope_unique` includes `term_id`. While that term is active, both rows count: P6 gives `[2]` for one person.
- **The demo has it.**
  - db/seed/demo/terms.ts:198-210 takes Electrical's first trainer by employee number as "secretary for this term only".
  - That trainer, 200015, is already Electrical's secretary for every term (D1).
  - So the demo shows nothing of a role held for one term, since the trainer keeps it after the term ends. The preview would also count Electrical's secretaries as 2.

Fix:
- Count `countDistinct(memberships.userId)`.
- In the seed, skip anyone who already holds the secretary role in Electrical.
- seed-demo.test.ts:484 can then check that the person holds the role in no other way.

Cost: 15 min.

**5. The wizard's framework copy, a Done when, and two guards have no test.**
- **The wizard's copy.**
  - `src/app/(app)/terms/actions.ts:96` passes `copyFrameworkInto` to `openNextTerm()`.
  - framework.test.ts:207 passes the copy itself.
  - actions-audit.test.ts:439 opens the next term before any framework exists, and expects only `term.create` (`:110`).
  - Removing `:96` fails nothing (M1).
- **Drafts hidden from those who do not manage terms.**
  - The switcher hides them at `src/app/(app)/_shell/term.ts:16`, and a term's page at `src/app/(app)/terms/[id]/page.tsx:54`.
  - Removing either fails nothing (M13, M14). No end-to-end test has a draft term to look at.

Fix:
- In actions-audit.test.ts, open the next term after the framework is published, and expect `["term.create", "framework.create"]`.
- In terms.spec.ts:107, open the new draft's address in a second context as the demo trainer (`STORAGE.trainer`), expect the not-found page, and expect no such term in the trainer's switcher.

Cost: 30 min.

**6. Two fields of an item take values no college has, so the page guards against what the schema let through.**
- **Where.**
  - `eventKind` is `z.string().min(1).max(40)` (`src/modules/framework/domain/inputs.ts:60`), though a calendar has exactly four kinds (`calendarEventKinds`).
  - `roleId` is any UUID (`:41`), with no foreign key, because it lives in JSON.
- **Probe P7.** The actions' schema takes an unknown role and the kind "anything", and `addItem` saves it.
- **On the page.** `src/app/(app)/framework/page.tsx:105-108` prints an unknown kind as its raw key, and an unknown role prints as "" (`:132`).

Fix: in the two item actions (the domain may only import types from the terms module), refuse a kind outside `calendarEventKinds` and a role that is not one of the college's non-system roles. Then drop the fallback at `:105-108`. Cost: 20 min.

**7. None of the three new specs runs on the production images, and one of them could not as written.**
- **The rule.** "A new journey's spec joins the list in `e2e/stack.config.ts`" (docs/PLAN.md:732).
- **What is missing.** `testMatch` (e2e/stack.config.ts:20-33) has none of terms.spec.ts, axes.spec.ts or framework.spec.ts. Audit 4 found the same gap for two specs (its minor 2).
- **What never runs behind Caddy**, as the app's non-owner database role: the header's term switcher, Today's week, a term's page and the refusal of `/terms` (terms.spec.ts:290), the refusal of `/axes` (axes.spec.ts:78), and a trainer reading the framework (framework.spec.ts:119).
- **Why `:290` cannot join as written.** It signs in an account it makes in the database (`account()`, e2e/support/accounts.ts:28), without the `@database` tag that keeps such a test out of the smoke.

Fix: let that test use the demo trainer, `test.use({ storageState: STORAGE.trainer })`, as framework.spec.ts:117 does. Then add the three specs to `testMatch`. Cost: 15 min, plus a CI run.

**8. `term.manage` now edits settings but does not require two-factor.**
- **The rule.** "Mark every key that changes access, accounts or settings that way" (docs/PLAN.md:774).
- **What changed.** Step 13 gave `term.manage` the three calendar settings (registry.ts:162, `:170`, `:178`), and permissions.ts:34 keeps `requiresTwoFactor: false` on it.
- **The effect.** With `auth.requireTwoFactor` on, the vice-dean changes how every term's weeks are counted without two-factor, while every other key that edits a setting requires it.

Fix: either mark `term.manage` as requiring two-factor, or record in the note under Step 9 that settings given to a role's own key follow that key. The second is one line. Cost: 5 min, plus the matrix and reach tests if the key is marked.

**9. Step 15's title ends with "(Step 15)".**
- The plan asks for "(step NN)" (docs/PLAN.md:36).
- `git log --oneline --grep "(step "`, the auditor's own command, lists 459c921 and 6a7ef8e but not 6e89591. The next review would miss it.

Fix: give PR #36 and its squash commit a title ending in "(step 15)". Cost: 1 min.

## Enhancements (at most 3)

1. **A guard for the smoke's list of specs.**
   - A unit test reads `e2e/*.spec.ts`. It fails on any spec that is neither in `e2e/stack.config.ts`'s `testMatch` nor named in a short list of database-only specs, each with its reason.
   - Benefit: Audit 4 and this audit found five specs missing in four steps. The test finds the next one in its own step's pull request.
   - Cost: 30 min.
2. **Demo data for the states this range added but the demo never shows.**
   - Approve the 1448 holidays whose estimate matched the announced calendar exactly. docs/reviews/eid-breaks.md has those dates, and the vice-dean would have approved them by October.
   - Start the framework's version 2 as a draft with one change. The vice-dean's `/framework` then shows the draft, its impact preview and the published version side by side.
   - Benefit: UX review 2 (after Step 20) reviews the term and framework screens. It then sees the approved state, the item editor and the preview on demo data, without clicking, and seed-demo.test.ts can check them.
   - Cost: 30 min. The demo data changes once.
3. **A seeded holiday week, in place of a moved clock, for the calendar sweep in docs/BACKLOG.md.**
   - A clock moved months ahead does not work here: the trainer landed on the login page. One college holiday over this week, inserted before `seed:demo`, gives exactly the state of a day in an Eid break (P1).
   - A nightly job does that, then runs the specs that read demo data (`--grep-invert @database`).
   - Benefit: it would have found major 1. Steps 23, 24 and 27 add many more journeys that read the demo term's week.
   - Cost: about 1 h, plus one short run a night.

## How this audit left the environment

- **Database `college`.** It ends freshly reseeded with the real clock, so it holds nothing from the end-to-end runs:
  - 1 term, 6 calendar events, 30 holidays;
  - 13 axes in 4 groups;
  - the published framework of 10 items;
  - 539 audit events.
- **Throwaway database.** I made `audit15_clock` three times: for the clock-moved seed, for P1 and P2, and for C1. It is dropped. Testcontainers left no container behind.
- **Docker.** `college-dev-postgres-1` runs as I found it.
- **Servers.** None is running, and port 3000 is free.
- **Files.**
  - `pnpm build` rewrote `.next/`, and the static files and `public/` are copied into `.next/standalone`.
  - The end-to-end runs rewrote `test-results/`, `.local/e2e/admin.json` and `.local/e2e/trainer.json`. The last setup run signed in on the throwaway database, so the two JSON files hold sessions of a dropped database until the next run's setup writes them again.
  - The scratch copy of HEAD, the mutation scripts, the probes, the clock preload and their logs are in the session's scratchpad: `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/a15/`.
- **Repository.** Nothing changed except this report, which is not committed.

## Resolution (review/audit-15)

- The fixes started on `step/15-framework` at `6e89591`, the tree the audit judged, while PR #36's CI ran. Branch `review/audit-15` then moved onto `main` at `8c00e1d`, once #36 (Step 15, squashed as `feat: the general framework (step 15) (#36)`, which also settles minor 9) and #39 (the checks job's 30 minutes) had merged. The trees match. The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor finding gets a disposition here.
- The squash-merge to `main` is titled `audit: steps 13-15`.

| Finding | Disposition |
| --- | --- |
| Major 1: two end-to-end tests pass or fail by the date | **Fixed as proposed.** terms.spec.ts takes today on the college's clock (`wallClock()` in `locale.timeZone`'s default) for this year and for the approval test, whose holiday now falls on the first Friday at least two days ahead. The trainer's journey runs on the demo trainer (`STORAGE.trainer`), looks for Today's badge inside `main`, and accepts "أسبوع إجازة" in the weeks as well as week 9. In P1's state, one college holiday over this week, it no longer finds two elements. |
| Major 2: the term page's weeks fail contrast | **Fixed, first option.** A tinted row of `term-weeks.tsx` (this week, or a holiday week) writes its Hijri days and what the week holds in the foreground. The terms list's dates turn to the foreground under the pointer, whose tint is now `muted/60`, as a notification row's. The token test adds the holiday week's tint (`muted/40`) with the foreground on it. The term journey runs axe once the holiday week is added, so its term always shows a tinted row. |
| Major 3: evidence types are a closed list in code | **Fixed as proposed.** A policy's `types` are extensions (`[a-z0-9]{1,10}`, at least one, none twice); `evidenceTypes` and its five messages are gone. The sheet offers `files.acceptedTypes` in capitals, and a new item starts with the first. The item actions read the setting and pass it to `addItem()`/`updateItem()`, which refuse a type outside it with `notOffered`. An item opened in the sheet keeps only the types the setting still holds, so one the admin has taken off cannot block its save (framework-draft.test.ts). The demo items name extensions, and the seed throws if an item is refused. |
| Minor 1: adjusting an Eid break strands a term's events | **Fixed as proposed.** `updateHoliday()` takes the calendar settings and, before it writes new days, checks each term that is not closed with `outside()`. It refuses with `eventsOutside`, naming the term and its events, and the sheet says "يخرج من {term} بهذا التغيير: …". To share them without an import cycle, `calendarOf()` and `outside()` moved from `server/terms.ts` into the terms domain (`domain/weeks.ts`); the module's index exports `calendarOf` from there. P4's sequence is an integration test: the finals in the last week of the term of 1448, then Eid al-Adha shortened by its first week, is refused, and the break keeps its days. |
| Minor 2: a closed term's draft takes changes | **Fixed as proposed.** `draftOf()` joins the term, locks it with the draft, and answers `closed` for a closed term's draft, so every item change, the endorsement and the publication refuse it. The page shows a closed term's framework read-only to those who prepare it too. P3's sequence is an integration test. |
| Minor 3: "after an event" counts past the term | **Fixed as proposed.** `TermShape.events` holds each calendar day's last numbered week by kind, and an "after an event" rule counts only when its due week is inside the term. The page computes those weeks with `termWeeks()`. count.test.ts has P5: a week after the midterms and the finals counts 1, at once counts 2. The note under Step 20 records the rule. |
| Minor 4: holders counted by membership | **Fixed as proposed.** `countMembers()` counts distinct people. The seed's one-term secretary skips trainers already secretary of the department, and seed-demo.test.ts checks that the person holds that role for this term only. The people test now lists each person's roles for every term, since Electrical has two secretaries this term. |
| Minor 5: the wizard's copy and the drafts' privacy untested | **Fixed as proposed.** actions-audit.test.ts opens the next term after the framework is published and expects `term.create` and `framework.create`. In terms.spec.ts, the demo trainer gets the not-found page at the new draft's address and finds neither draft in the switcher. |
| Minor 6: an item's calendar kind and role unchecked | **Fixed.** `addItem()`/`updateItem()` refuse, with `notOffered`, a kind outside `calendarEventKinds` and a role that is not one of the college's non-system roles (the domain cannot import the terms module's values, so the check sits in the service, beside the file types). The page's fallback for an unknown kind is gone. |
| Minor 7: the new specs miss the stack's smoke | **Fixed as proposed.** `e2e/stack.config.ts` lists terms.spec.ts, axes.spec.ts and framework.spec.ts; their tests that make accounts keep the `@database` tag. CI's "Production stack" job runs them on this PR. |
| Minor 8: `term.manage` edits settings without two-factor | **Recorded, second option.** Marking the key made the demo seed set up two-factor for the vice-dean, who would then enter a code at every demo sign-in, against the owner's choice to keep two-factor optional (ADR-0014). A note from Audit 5 under Step 9 says that a setting a role's own key edits follows that key's mark. |
| Minor 9: Step 15's title | **Settled** by #36's squash title, `feat: the general framework (step 15) (#36)`. |
| Enhancement 1: a guard for the smoke's list of specs | **docs/BACKLOG.md.** It needs a stated reason for each spec that stays out (the design catalog, the identity font, streaming), which nothing records yet. |
| Enhancement 2: demo data for the range's states | **Applied.** The vice-dean has approved the coming holiday as estimated, so `/terms` shows both states. The framework's version 2 waits as a draft, its grade analysis two weeks after each exam, so the vice-dean's `/framework` shows the draft, its preview and the published version together. seed-demo.test.ts checks both. |
| Enhancement 3: a seeded holiday week for the calendar sweep | **docs/BACKLOG.md**, beside Audit 4's calendar sweep, which it amends. |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all` | exit 0 in 2 m 14 s · `Checked 556 files in 595ms. No fixes applied.` · `Test Files  98 passed (98)` · `Tests  711 passed (711)` · `check:hardcode passed.` · `✔ no dependency violations found (483 modules, 2098 dependencies cruised)` |
| `pnpm check:unused` | knip exit 0 |
| `pnpm build` (as CI builds it), the static files and `public` copied into `.next/standalone`, a fresh database, then `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts e2e/terms.spec.ts e2e/axes.spec.ts e2e/framework.spec.ts --grep-invert @visual` | `Running 16 tests using 2 workers` · `16 passed (55.3s)` |
| The same build and a fresh database, then every spec: `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual` | `Running 274 tests using 2 workers` · `248 passed (7.0m)` · `25 skipped` · `1 flaky`: people.spec.ts:543, the account menu's link to changing the password, passed on its retry. It is lead review B's "to watch" item in docs/BACKLOG.md and touches nothing this audit changed. This build came before the sheet's filter of an item's types, which its unit test covers; CI runs the final tree. |

**Mutation checks.** I applied each change, ran only the named test, then restored the file.

| Mutation | Result |
| --- | --- |
| `occurrences()` counting an "after an event" task past the term | count.test.ts: `Tests  2 failed \| 7 passed (9)` |
| `draftOf()` taking a closed term's draft | framework.test.ts: 1 failed, "takes only what the college offers, and nothing once its term has closed" |
| The service taking a file type the college does not accept | the same test fails |
| The service taking a calendar kind no calendar has | the same test fails |
| The service taking the system role | the same test fails |
| `countMembers()` counting memberships | framework.test.ts: "counts the enabled holders of each role in each active department" fails |
| `updateHoliday()` saving days that strand the finals | terms.test.ts: `Tests  2 failed \| 8 passed (10)` |
| The sheet keeping an item's types the college no longer accepts | framework-draft.test.ts: `expected [ 'pptx', 'pdf' ] to deeply equal [ 'pdf' ]` |
| `openNextTermAction` without the framework's copy (M1) | actions-audit.test.ts: `expected [ 'term.create' ] to deeply equal [ 'term.create', 'framework.create' ]` |

### Known limits

- The smoke with the three specs added runs in CI only: this container has no images of this build.
- A holiday adjustment checks the terms that are not closed one after another, a query for each term's events; a college has two or three such terms.

### Hand-off

- **docs/PLAN.md:** a note from Audit 5 under Step 9; the counting rule in the note from Step 15 under Step 20.
- **docs/BACKLOG.md:** the guard for the smoke's specs, and the seeded holiday week for the calendar sweep.
- **CHANGELOG.md:** the Audit 5 entry.
- **Owner:** nothing new from this audit.
