# Lead review C: term, framework and Rayat, the vice-dean's part (Steps 13 to 17)

- Section C in run order, from `git log --oneline a0544a4..HEAD` on `review/lead-C` (`a0544a4` is lead review B's merge, the `v0.2-B` tag):
  - ADR-0017, announcements, and its read counts: `51e2b49` (#29), `d905a6c` (#30). Lead review B did not see them.
  - Step 13 `459c921` (#32), with ADR-0018's amendment `3aa6d2f` (#33);
  - Step 14 `6a7ef8e` (#35) and Step 15 `8c00e1d` (#36);
  - Audit 5 `7551f05` (#40, docs/reviews/audit-15.md);
  - Step 16 `69f884a` (#42), ADR-0019 `961a71e` (#44) and Step 17 `e090bbd` (#45).
  - Merged meanwhile, not the section's work: `b044b07` (#39), `ab15c8b` (#38), `a823ba9` (#34), `61a4ec4` (#15), `1f0d56a` (#17). My runs showed none of them broken.
- Reviewed on `review/lead-C` at `e090bbd`, 2026-10-22, by the lead-engineer agent. That tree is `main` with Step 17 merged last, and **I review it as the section's final state.**
- How I ran it:
  - On the standalone build, as CI runs it, and `pnpm check:all` against an empty database, as CI's checks job has.
  - Five throwaway databases, all dropped at the end:
    - `lead_c_checks`, empty, for `check:all`;
    - `lead_c_e2e` for the suite;
    - `lead_c_trace` for the statement counts, the timings on demo data, the two traces and the write replays;
    - `lead_c_journeys` for the journeys on the iPhone 15 emulation;
    - `lead_c_scale`, a larger college. It has 12 departments, 300 trainers on the platform and 13 terms. Its SS01 holds 720 sections, its SF01 21,000 registrations and its SO01 6,166 absences, and it holds 107,605 notifications.
- Verdict: **Section C works as a system on demo data, with 4 must-fix items (about 3 hours in all) before the `v0.3-C` tag. One known item's premise broke in this section, and it is the owner's to re-decide.**
  - What holds:
    - `pnpm check:all` is green (793 tests). The full end-to-end suite passes with `265 passed` and `27 skipped` by design, with no flaky test and none failed.
    - All 25 actions the section added are in the permission matrix and in `actions-audit`, and every input has a bounded Zod schema.
    - A section of SS01 reaches every screen that names it, and the log. A term's weeks reach Today, the header, the term's page, the framework's preview and the sections' week.
    - Reads meet section 4's budget one request at a time on demo data (p95 36 to 71 ms). The writes I replayed meet 1 s at 20 at once (569 and 624 ms).
    - No trainee name, mobile number or grade is kept.
  - What must be fixed:
    - **M1.** The section's long selects hide options from a finger and a mouse. The framework item's kinds "نسخة اختبار" and "تحليل نتائج" cannot be chosen, and neither can weeks 1 to 10 of a transfer on a phone.
    - **M2.** A transfer stops matching what the page says of it once a newer SS01 names someone else:
      - kept against an SS01 that names a third trainer, it reads "بانتظار رايات" while the third trainer has the section;
      - once SS01 confirms it, the weeks before it are said to be the new trainer's. The note under Step 20 tells the engine to use those weeks.
    - **M3.** Two pages query once per row: `/terms` once per term, and `/sections` once per department.
    - **M4.** `sections.spec.ts` is missing from the production stack's smoke, against the plan's rule.
  - The known item: lead review B's proposal 7, the byte budget for `readTable()`, was put off to Step 40 while uploads stopped at 1 MB. Step 16 raised the limit to 10 MB. A 9.6 MB workbook now takes the reader past 8 GB of memory in 27 s.

## Must-fix (before tagging `v0.3-C`)

Ordered as found: the journeys' failure first, then correctness, then the plan's rules.

### M1. The section's long selects hide some of their options, on a phone and on the desktop

- **Evidence.**
  - Counting the framework journey on the iPhone 15 emulation, the tap on "نسخة اختبار" in the item sheet's kind list failed: `locator.tap: … element is outside of the viewport`. The screenshot shows the list opened upward, its first rows behind the sheet's title and above the screen.
  - A probe opened each select of the section's sheets, scrolled each option into view as far as the page allows, then clicked the first one still off the screen (`select-reach.ts`, `lead_c_journeys`):

    ```
    phone   | framework item: kind: 8 of 11 options on screen; off it: بند عام، نسخة اختبار، تحليل نتائج (clicking «بند عام» fails: element is outside of the viewport)
    phone   | transfer sheet: from week: 8 of 18 options on screen; off it: الأسبوع 1 … الأسبوع 10 (clicking «الأسبوع 1» fails: element is outside of the viewport)
    desktop | framework item: kind: 8 of 11 options on screen; off it: بند عام، نسخة اختبار، تحليل نتائج (… outside of the viewport)
    desktop | transfer sheet: from week: 10 of 18 options on screen; off it: الأسبوع 1 … الأسبوع 8 (… outside of the viewport)
    ```

    The axis (13), audience (7) and due (4) lists fit.
  - The keyboard still reaches them: eight presses of ↑ and Enter set "الأسبوع 1" on both devices. A phone has no such keys, and the desktop needs them.
  - **Cause.** `src/components/motion/select.tsx:378-388` flips the panel upward when there is less room below. The panel is `absolute … overflow-hidden` (`:454`) with no height bound and no scroll, so a list taller than the room on its side runs off the screen. In a bottom sheet nothing can scroll it back.
  - **What it costs.**
    - The vice-dean cannot give an item the kinds Step 18 builds on, exam copies and grade analysis, by touch or by mouse.
    - A head cannot transfer a section from an earlier week, for a change that Rayat or the department recorded late.
  - **Why the tests pass.**
    - `e2e/framework.spec.ts:84-87` saves an item with every default.
    - `e2e/sections.spec.ts:104-115` keeps this week.
    - Neither opens a long select.
- **Fix.**
  - In the shared select, bound the panel to the room on the side it opens toward, less a margin. Let its list scroll (`overflow-y: auto`), with the active option scrolled into view on open. This fixes every long select at once, including a role's scope as departments grow.
  - Tests on the iPhone project:
    - the transfer sheet chooses "الأسبوع 1" by tap;
    - the item sheet chooses "نسخة اختبار" by tap.
  - Both fail today with `outside of the viewport`.
- **Cost:** 45 min.

### M2. A transfer and SS01 drift apart: a kept transfer can do nothing, and a confirmed one rewrites the weeks before it

- **Evidence.** Trace 1 on the production build (`lead_c_trace`), on the demo's transfer of section 30112 from 200001 (فهد الزهراني) to 200019 (بندر الشهراني) from week 9. Each newer SS01 was uploaded and applied on `/rayat` by the vice-dean; the head read `/sections`.

  | Step | What the head's card says | Trainer the card names | `listSections()` |
  | --- | --- | --- | --- |
  | Before | بانتظار رايات · من الأسبوع 9: بندر الشهراني بدل فهد الزهراني | بندر الشهراني | week 5: 200001, week 9: 200019 |
  | An SS01 naming 200020 for 30112 is applied | يخالف رايات, with "أبقِ النقل" and "ألغِ النقل" | ماجد الرشيدي (200020) | |
  | **The head keeps it** | **بانتظار رايات**, the same line as before | **ماجد الرشيدي** | **week 9: 200020** |
  | That SS01 is rolled back | بانتظار رايات | بندر الشهراني | |
  | An SS01 naming 200019 is applied | أكّده رايات | بندر الشهراني | **week 5: 200019** (was 200001) |

  The domain function gives the same on its own (`transfer-domain.ts`), with the integration test's numbers: 200101 replaced by 200103 from week 6, and 200109 the third trainer:

  ```
  2. after the head keeps it: status   "holds"
  2. trainers in week 9 after keeping  ["200109"]     ← Rayat's third trainer; the transfer applies to no one
  1. newer SS01 names 200103: status   "confirmed"
  1. trainers in week 3 (200101 taught it)   ["200103"]
  ```

  - **Why.**
    - `trainersInWeek()` (`src/modules/academics/domain/transfers.ts:14`) replaces the replaced trainer's number only where Rayat still names it. When SS01 names a third trainer, a kept transfer replaces no one.
    - Once SS01 names the new trainer, nothing gives the weeks before the transfer back to the trainer it replaced.
    - The integration test keeps a transfer only in the case that works: Rayat still naming the replaced trainer (`tests/integration/sections.test.ts:351-358`).
  - **What it costs.**
    - Today, the card tells the head the transfer holds while someone else has the section.
    - At Step 20, the note under it (docs/PLAN.md:1069) has the engine assign each week by `trainersInWeek()`. A confirmed transfer would then hand the new trainer the weeks before it. Their tasks are keyed by assignee, so the engine would make the new trainer a second copy of work the old trainer completed. A kept transfer would send the section's later tasks to the third trainer.
  - **A smaller cause of false conflicts.** `transferStatus()` (`:42`) compares the transfer with when the version in force was applied. A file uploaded before the transfer was made, and applied after it, cannot know of the transfer, but it is still read as a conflict. The upload time is the better proxy for when the file left Rayat.
- **Fix.**
  - `trainersInWeek()` starts from Rayat's numbers with each confirmed transfer undone, latest first, wherever Rayat names its new trainer and not the one it replaced. It then applies the transfers in force by the week, as now.
  - "Keep" is offered only while Rayat still names the replaced trainer. When Rayat names neither trainer, the card says "رايات يسمّي مدربًا آخر" and offers cancelling, or a new transfer from that trainer.
  - `transferStatus()` takes the version's upload time.
  - Unit tests:
    - a confirmed transfer gives week 5 to the replaced trainer;
    - a transfer whose replaced trainer Rayat no longer names is not offered for keeping;
    - a transfer made after an upload and before its apply holds.
  - Update the note under Step 20.
- **Cost:** 1 h 15 min.

### M3. `/terms` reads each term's calendar apart, and `/sections` reads the directory once per department

- **Evidence.** Statements per warm request, from PostgreSQL's log with `log_statement = 'all'` on the throwaway database only:

  | Page | Demo (1 term, 3 departments) | Larger college (13 terms, 12 departments) | Per row |
  | --- | --- | --- | --- |
  | `/terms` (vice-dean) | 18 | 54 | 3 per term: `terms`, `calendar_events`, `holidays` (`src/app/(app)/terms/page.tsx:62`, `findTerm` per term) |
  | `/sections` (admin) | 36 | 72 | 4 per department: `people`, `memberships`, `sign_in_lockouts`, `role_permissions` (`transferCandidates()` per department, `src/app/(app)/sections/page.tsx:128`, each a whole `listDirectory()`) |

  - The pages are fast today: `/terms` p95 66 ms at 13 terms. But both counts grow, by about two terms a year and with each department. Lead review B found every page's statements fixed.
- **Fix.**
  - `/terms` reads all the listed terms' calendar events in one query, and the breaks once, from the earliest term's first day.
  - `/sections` reads the directory once for the departments it shows, and groups the candidates by department.
  - A test that counts statements (with `tests/integration/support/plans.ts`'s recorder) expects the same count for one term as for five.
- **Cost:** 45 min.

### M4. The production stack's smoke does not run the sections spec

- **Evidence.** `e2e/stack.config.ts:20-37` lists 14 spec files, the setup and the smoke, without `sections.spec.ts`. The rule is "A new journey's spec joins the list in `e2e/stack.config.ts`" (docs/PLAN.md:732). Audits 4 and 5 each found specs missing from that list. The first test in that file reads the demo's sections as the head of Electrical, on demo accounts, without `@database`. So no run behind Caddy, with the app's own database role, ever opens `/sections`.
- **Fix.** Add `sections.spec.ts` to `testMatch`. Its transfer test keeps the `@database` tag. The guard waiting in docs/BACKLOG.md (Audit 5, enhancement 1) would have caught this.
- **Cost:** 10 min, plus CI's "Production stack" run.

## A known item found broken: lead review B's proposal 7, the byte budget for `readTable()`

- **Then.** Lead review B measured a 918,804-byte workbook whose sheet inflates to about 900 MB. The reader held 1,096 MB for 3.4 s before refusing it. The owner put the cap off to Step 40 while a server action took at most 1 MB.
- **Now.**
  - Step 16 raised every server action's body to 10 MB (`MAX_UPLOAD_BYTES`, `next.config.ts`). That covers the people file and the three Rayat reports.
  - ADR-0019 lets the admin give the Rayat key to heads.
  - A 9,646,799-byte workbook, under the limit, whose one sheet inflates to about 3.3 GB, read with the app's own `readTable()` in a child process (`bomb-read.ts`):

    ```
    killed past 8 GB
    exit 137 peak rss 8027152 kB      (27 s)
    ```

    In the server, that is the one Node process that answers everyone.
- **Recommendation.**
  - Take the cap with this review's fixes rather than at Step 40: check the archive's declared sizes, or read the sheet with a budget of about 20 MB. A real SF01 of 21,000 rows is 1.56 MB.
  - The owner decides; it is their earlier decision.
- **Cost:** 45 min, lead review B's estimate.

## Proposals, ranked by benefit over cost

| # | Proposal | Benefit | Cost | Plan change |
| --- | --- | --- | --- | --- |
| 1 | Decide whom "مدرب كل شعبة" reaches in a co-taught section and in one without a trainer, and give the demo such sections | The preview and the Step 20 engine agree on real SS01 files, not only on the demo's one-trainer sections. Today none of the demo framework's items reaches a section, so its preview never uses sections | 45 min | no; a note under Step 20 |
| 2 | Add a trainer from the unmatched report | Journey 4b goes from 3 views, 12 taps and 3 fields to 2 views, 6 taps and 2 fields, and the employee number is never typed again. A mistyped number keeps a section unmatched, against section 1's metric "SS01 sections matched to their trainer: 100%" | 45 min | no |
| 3 | A conflict reaches the head who resolves it | Today a head learns of a conflict only by scrolling `/sections`, under "المزيد" on a phone, and the vice-dean applies SS01 without seeing whose transfer it breaks | 2 h | ADR-0020 |
| 4 | An index for the announcements' read counts and withdrawal | Two whole-table scans become index lookups: 17.9 ms on every `/announcements` and 11.0 ms per withdrawal at 107,605 notifications, growing with Step 27's reminders | 15 min | no |
| 5 | Sections for whoever imports SS01, one department at a time | The vice-dean sees the sections SS01 made (section 1: "Every department down to trainer, section …, read only"). The college-wide page drops from 3.9 MB and 523 ms p95 to one department's 0.4 MB and 135 ms | 1.5 h | no; a note under Step 17 |
| 6 | Calendar settings refuse a value that strands a term's events | The same rule Audit 5 gave a holiday's adjustment. Today, turning `calendar.skipHolidayWeeks` off ends a 1448 term four weeks sooner and blocks every later change to it | 40 min | no |
| 7 | Tell the dean when a draft waits for endorsement, and the vice-dean when it is endorsed | The round trip (7 taps over 3 visits) stops depending on each of them opening `/framework` to look | 1 h | ADR-0021 |
| 8 | One upload for the three reports | Journey 4a goes from 13 taps to 7, every time the reports change in the add and drop weeks | 2 h | no |
| 9 | A budget for file imports | A 21,000-row SF01 takes 3.4 s against section 4's 1 s for writes. Either the budget says what an import may take, or the check runs in the worker with progress (section 2 lists imports among the worker's jobs) | 15 min, or 3 to 4 h for the worker | ADR-0022 |

### 1. Decide whom "each section's trainer" reaches, and let the demo show it

- **Now.**
  - `countTasks()` counts an "each section" item once per section (`src/modules/framework/domain/count.ts:57`, `department.sections`).
  - The plan's engine makes "one task per source item, occurrence, assignee and section" (section 3).
  - SS01 can name several trainers for a section, one per meeting row, and the import keeps them all (`trainerNumbers`; the integration fixture's 30102 has two). It can also name none ("a section may not have its trainer yet", `src/modules/rayat/domain/reports.ts`).
  - So a co-taught section counts 1 in the preview and makes 2 tasks in a per-assignee engine. A section without a trainer counts 1 and makes none.
  - Step 20's "Done when" compares the preview with the tasks generated "for every demo framework and plan". The demo has neither kind of section, and its framework has no item for each section: trace 1 read 597 tasks from roles alone. Adding one item due in week 5 made 629, one per section.
- **Proposal.**
  - Decide the rule and record it under Step 20. My suggestion: one task for each trainer of the section, as the plan's key says, and none for a section without one, which the preview names apart.
  - `departmentsReached()` then counts section and trainer pairs.
  - The demo SS01 gets one co-taught section and one without a trainer. The demo framework gets one item for each section, the exam copy.
- **Cost:** 45 min.

### 2. Add a trainer from the unmatched report

- **Now.**
  - The SS01 card lists "209001: الشعبة 30111" and says to add them "في صفحة المنسوبين بالرقم الذي يكتبه رايات". Only `people.manage` adds people, so the vice-dean and a head who import can only pass the number on.
  - The admin's path is `/rayat`, `/people`, then `/people/new`, typing the number, the name and the email and choosing the role and the department: 3 views, 12 taps, 3 fields.
  - Afterwards the report emptied and `/sections` named the trainer, as it should.
- **Proposal.** For whoever holds `people.manage`, each line links to `/people/new` filled with the employee number, the section's department and the trainer's role. The admin types the name and the email: 2 views, about 6 taps, 2 fields. Others read who adds them.
- **Cost:** 45 min, with an iPhone test.

### 3. A conflict reaches the head who resolves it (ADR-0020)

- **Now.**
  - The plan asks that "conflicts with a newer SS01 [be] flagged for review" (Step 17).
  - The pending SS01's diff said only "تغيّر 1 · تغيّر المدربون: الشعبة 30112". Nothing told the vice-dean that applying it would put a head's transfer in conflict.
  - After it was applied, the conflict showed only as a badge on that section's card, among a department's cards, on a page under "المزيد".
  - The demo has no conflict, so UX review 2 will not see one.
- **Proposal.**
  - The pending SS01 names the transfers it would confirm and those it would break.
  - Applying it tells each department's holders of `sections.transfer`, with `notify()` and a kind of its own, linking to the section.
  - `/sections` lists conflicts first, as it lists the transfers of sections SS01 dropped.
  - The demo seeds one conflict.
- **Cost:** 2 h.

### 4. An index for the announcements' read counts and withdrawal

- `announcementReads()` and `retractAnnouncement()` filter `notifications` on `params ->> 'announcementId'`. On `lead_c_scale`, both read the whole table: a Seq Scan, 15,350 rows kept of 107,605, in 17.9 ms, and 11.0 ms to withdraw one.
- Add `notifications ((params ->> 'announcementId')) where kind = 'announcement'` in a migration.
- **Cost:** 15 min.

### 5. Sections for whoever imports SS01, one department at a time

- **Now.**
  - `/sections` opens only for `sections.transfer`. The vice-dean imports SS01 and is refused the page, the dean too.
  - Whoever holds the key across the college, the admin by default, gets every section on one page: at 720 sections, 3,900,942 bytes (136,288 gzipped) and p95 523.5 ms one request at a time, over section 4's 300 ms.
  - A head of a 60-section department gets 409,360 bytes and 135 ms, and scrolls 60 cards on a phone to find one.
- **Proposal.**
  - `/sections` opens read-only for `rayat.import`, which is what the vice-dean holds, and keeps its controls for `sections.transfer`.
  - A college-wide viewer chooses a department, which the address keeps (nuqs).
  - A search box filters by reference, course or trainer.
- **Cost:** 1.5 h.

### 6. Calendar settings refuse a value that strands a term's events

- **Probe on `lead_c_trace`.** A term from 2027-01-10, 18 weeks, meets both Eid breaks of 1448. Its finals are in week 18. Then the settings service turned `calendar.skipHolidayWeeks` off:

  ```
  the new term: skip true | last day 2027-06-12 | week 18 is 2027-06-06..2027-06-12
  setting turned off: {"status":"saved","value":false}
  after the setting: skip false | last day 2027-05-15 | week 18 is 2027-05-09..2027-05-15
  renaming the term: {"status":"eventsOutside","events":["الاختبارات النهائية"]}
  ```

- Audit 5 made a holiday's adjustment refuse this (its minor 1). The three settings that count weeks do not: `calendar.skipHolidayWeeks` and `calendar.workingDays`, which the vice-dean holds, and `locale.weekStart`, the admin's.
- Run `outside()` on each term that is not closed before saving one of them, and refuse naming the term and its events.
- **Cost:** 40 min.

### 7. Tell the dean when a draft waits, and the vice-dean when it is endorsed (ADR-0021)

- **Now.** With `framework.requireEndorsement` on, the round trip measured 7 taps over 3 visits:
  - the vice-dean starts the version (2 taps);
  - the dean endorses (2);
  - the vice-dean publishes (3).

  No one is told that it is their turn.
- **Proposal.** Two notification kinds: "a draft waits for your endorsement" to the holders of `framework.endorse`, and "the dean endorsed the draft" to its preparers.
- **Cost:** 1 h.

### 8. One upload for the three reports

- **Now.** Each report takes its own file, check and apply, which is 9 of journey 4a's 13 taps.
- **Proposal.** One picker takes the three files. Each is recognised by its column map's headers, checked and diffed in its own card, and a single "طبّق" applies those that passed. Each report keeps its own versions and rollback.
- **Cost:** 2 h.

### 9. A budget for file imports (ADR-0022)

- **Through the server.**
  - The demo's SF01, 767 rows, takes 256 to 281 ms from "افحص الملف" to the page's "فُحص الملف".
  - The 21,000-row SF01, 1,557,823 bytes, takes 3,356, 3,364 and 3,386 ms.
- **Where the time goes** (in a domain probe):
  - reading the XLSX: 677 ms;
  - checks: 64 to 75 ms;
  - the diff: 14 ms;
  - inserting 21,000 records: 1.1 to 1.2 s, of which a single `unnest` statement saves about 15%.

  The college's lock is held for the check and the insert, so term, framework, transfer and department changes wait about 2 s.
- **Proposal.** The owner chooses:
  - record a measured budget for imports in section 4, extending ADR-0010's measured budgets, such as 5 s for 25,000 rows (15 min);
  - or run the check and the insert in the worker with progress (3 to 4 h).
- **Cost:** 15 min, or 3 to 4 h.

### Smaller items, each under 15 minutes

- The item sheet's "يشمل" starts on the dean, the first role in order, so an item for trainers needs two more taps. Default to the trainer's role or to each section's trainer.
- `/framework` computes the preview's inputs for every reader: `countMembers()`, the whole SS01 and the calendar. A trainer's page sends 26 statements, the same as the vice-dean's.
- `/sections` and `/framework` read the term's calendar twice per request: `findTerm()` again after the shell's cached `termOnDay()`.
- Migrations `0017` and `0018` state no inverse in their header, while `0013` to `0016` do (lead review A's proposal 10).
- `enabledPeopleIn()`, which decides whom an announcement reaches, and the department filter of `listDirectory()`, behind the transfer candidates, count a role held only for a closed term. `countMembers()` does not.
- `updateHoliday()` locks only its row while it checks the open terms' events. Every other calendar change takes the college's lock.
- The vice-dean's phone tabs give "الإعدادات" (three calendar settings) a tab and put "استيراد رايات" under "المزيد". A `navigation.order` default for the vice-dean's role is data.

### Lead reviews A and B's proposals that this section bears on

They wait for the owner in docs/BACKLOG.md. I do not rank them again; the section's evidence changes their weight:

- **Lead review A, proposal 6: a load level for the server budget.**
  - At 10 concurrent requests, 14 of the 16 pages I measured exceed 300 ms at p95; the 16 range from 285.9 to 588.0 ms. At 20 they reach 815 to 1,553 ms.
  - Writes stay under 1 s at 20 at once.
- **Lead review A, proposal 10: migrations expand, then contract.**
  - `0017` and `0018` state no inverse.
  - `v0.2-B`'s image on this schema would ignore `memberships.term_id`, so a role given for one term would grant its keys in every term.
- **Lead review B, proposal 4: one helper for the actions' glue.** `changeBy()` is now copied in five action files (departments, framework, Rayat, sections and terms) and `drawn()` in three. The diff's and the framework's `canonical()` are two copies.
- **Audit 5, enhancement 1: a guard for the smoke's list of specs.** It would have caught M4.

### Proposed ADRs

| ADR | Decision |
| --- | --- |
| **ADR-0020, a conflict reaches the head** (proposal 3, if accepted) | A pending SS01 names the transfers it would confirm or break. Applying it tells the departments' holders of `sections.transfer`, and `/sections` lists conflicts first. |
| **ADR-0021, the endorsement hand-off** (proposal 7, if accepted) | The holders of `framework.endorse` are told when a draft waits for them, and its preparers when it is endorsed. |
| **ADR-0022, a budget for imports** (proposal 9, if accepted) | Either a measured budget for file imports in section 4, or imports run in the worker with progress. |

ADR-0011 and ADR-0012 stay reserved for lead review A's pending proposals, and ADR-0013 is unused, so the new ones start at 0020. M2's fix amends the note under Step 20 and needs no ADR.

## Evidence

### 1. Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all` (`TESTCONTAINERS_RYUK_DISABLED=true`, `DATABASE_URL` on the empty `lead_c_checks`, as CI's checks job) | exit 0 in 150 s · `Checked 599 files in 607ms. No fixes applied.` · `Test Files  106 passed (106)` · `Tests  793 passed (793)` · `check:hardcode passed.` · `✔ no dependency violations found (517 modules, 2288 dependencies cruised)`. One `DeprecationWarning` from pg, the one audit-12 lists among its known limits |
| `pnpm check:unused` · `drizzle-kit generate` on a scratch copy of HEAD (`git archive`) | knip exit 0 · `No schema changes, nothing to migrate` |
| `APP_URL= DATABASE_URL= AUTH_SECRET= pnpm build`, then `.next/static` and `public` copied into `.next/standalone` | exit 0 in 38 s · `✓ Compiled successfully in 17.3s` · `✓ Generating static pages using 3 workers (37/37) in 972ms` |
| `db:migrate`, `db:seed`, `seed:demo` on `lead_c_e2e` | `seed:demo finished with --seed 42 --week 9`, 19.6 s for the three. Rows: people 47, audit_events 551, notifications 155, terms 1, calendar_events 6, holidays 30, axes 13 in 4 groups, frameworks 2 (version 1 published, version 2 a draft, 10 items each), rayat_imports 4 (3 applied, 1 waiting), rayat_sections 32, rayat_enrollments 1,532, rayat_absences 219, section_transfers 1, announcements 2 |
| `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual` | `Running 292 tests using 2 workers` · `27 skipped` · `265 passed (7.1m)`. No flaky and no failed test. Every skip is a device's (`test.skip` by phone, desktop or touch); none is in the section's specs |
| Timings, statement counts, the traces and the journeys on my own standalone servers (ports 3300 to 3302) | Parts 2, 4 and 6 |
| GitHub | Not read: the environment allows no network beyond the package registries |

The production images cannot be built here: Docker builds have no network. CI's "Production stack" job covers them, as lead review B describes. Its smoke lists the section's terms, axes, framework and Rayat specs, but not the sections spec (M4) or the announcements spec (left out on purpose: each of its tests makes accounts).

### 2. Integration: two records traced

No PDF exists yet (Step 32), so the traces end at screens and the log.

**Trace 1: a section of SS01** (30112, كهر 101, in Electrical), on the production build (`lead_c_trace`):

- **The file.** The vice-dean's SS01, whose two meeting rows name the section, becomes one record of `rayat_sections`: its course, hours, mode, meetings, numbers and trainers. The trainer's name, which the export carries, is dropped while the file is read.
- **`/rayat`.**
  - The SS01 card: "32 شعبة", "آخر تحديث", "رفع الملف" and, from ADR-0019, the uploader and the applier.
  - The unmatched report: "209001: الشعبة 30111".
  - A newer file's diff: "تغيّر 1 بقي 31 · تغيّر المدربون: الشعبة 30112".
  - Earlier versions: "رُجع عنها 32 شعبة، رفعها سلمان الغامدي …".
- **`/sections`, the head of Electrical.**
  - "كهر 101 · ساعتان معتمدتان · حضوري", "الدوائر الكهربائية · الشعبة 30112";
  - the trainer this week;
  - "الأربعاء 12:30 - 14:10 · المبنى 2، القاعة 204" and Monday's meeting;
  - "25 من 25 مقعدًا", with SF01's "منسحب 1 ومسجل 23 ومحذوف 1";
  - the transfer, with its badge, reason, author and date.
- **A transfer across newer SS01s.** The table under M2: holding, in conflict, kept, rolled back and confirmed.
- **The framework's preview.**
  - The demo draft's 10 items reach roles only: "ينشئ 597 مهمة في 3 أقسام".
  - One item for each section's trainer, due in week 5, made it 629: one per section of SS01 in force.
  - On the journeys' database, the item that journey 3a added, for each section after each exam, made 661: two exams for each of the 32 sections.
- **The unmatched report, end to end.** Once the admin added 209001 (journey 4b), the report emptied, and `/sections` named the trainer instead of "209001 (ليس في المنصة)".
- **The log.** `/audit?action=…` lists:
  - `rayatImport.upload`, with the report, the term and its counts;
  - `rayatImport.apply` and `rayatImport.rollback`;
  - `sectionTransfer.create`, with the week, the reason, the term, the person and the trainer replaced;
  - `sectionTransfer.keep`.

  Each has its actor, address and device.

**Trace 2: a term**, the demo term in week 9. The probe added a holiday over this week's working days with the calendar's own service, the one the term page's sheet calls, read every page, then removed the holiday:

| Where | Before | With this week a holiday |
| --- | --- | --- |
| Today (trainer) | الأسبوع 9 من 18 | أسبوع إجازة |
| The header's switcher | الفصل التدريبي: الفصل التدريبي الأول 1448، الأسبوع 9 | …، أسبوع إجازة |
| The term's page | this week's row "الأسبوع 9 · 18–24 أكتوبر"; the term ends 26 December 2026 | the row reads "إجازة"; the term ends 2 January 2027 |
| `/sections` transfer sheet | من الأسبوع: الأسبوع 9 | الأسبوع 8, the last numbered week begun |
| `/framework` preview | ينشئ 629 مهمة في 3 أقسام | unchanged: the finals move to week 17, and no item's count crosses the term's last week |
| `/rayat` | the term's name, which every file must carry | unchanged: it reads the name and status only |

- The switcher keeps a term chosen by the viewer, and drafts stay with whoever manages terms (Audit 5).
- A file for another term was refused before anything was kept, in the end-to-end run.

### 3. Architecture

- **Boundaries.**
  - `pnpm check:boundaries` is green (517 modules). No import in `src`, `worker` or `db` reaches past another module's `index.ts`.
  - `domain/` holds the pure parts: the weeks, the Eid estimates, the counting, Rayat's reading, checks and diff, and the transfer rules.
- **The model.**
  - Courses, sections and enrollments are read from SS01 and SF01 in force, not copied into tables of their own. That departs from section 3's model and is recorded in the notes under Steps 17 and 20 and in CHANGELOG.md.
  - It keeps one source of truth and makes rollback exact.
  - Its cost: each read loads its version's records. `/sections` loads all of SF01, 21,000 rows at scale, to count registrations by status, and all of SS01 for every department. A `group by` returns 1,653 rows in 6.3 ms.
- **Duplicated logic**, all small:
  - `changeBy()` ×5 and `drawn()` ×3 in action files;
  - `canonical()` ×2;
  - the term's calendar read twice on two pages;
  - "this week" computed two ways, the shell's `weekOf()` (none in a holiday week) and `/sections`' last numbered week begun. Each fits its use.
- **Locks.**
  - Terms, the framework's draft, the Rayat imports and transfers take the college's advisory lock (lead review B's fix).
  - `updateHoliday()` takes only its row (smaller items).
  - An SF01 upload holds the lock about 2 s at 21,000 rows (proposal 9).
- **Migrations** `0013` to `0018` match the schemas, and none drops a column or a table.

  | Migration | What it does | Its inverse |
  | --- | --- | --- |
  | `0013` | `announcements` | Drop it and delete the `announcement` notifications; stated in its header |
  | `0014` | `terms`, `calendar_events`, `holidays`; `memberships.term_id` in the scope's unique key | Stated in its header. Dropping `term_id` turns every one-term role into a role for every term |
  | `0015` | `axis_groups`, `axes` | Drop them; stated |
  | `0016` | `frameworks`, `framework_items`, a key on `axes`, the deans' `framework.endorse` | Stated. The key rows cannot be told from an admin's later grants, as `0009`'s |
  | `0017` | `rayat_imports` and the three record tables | Drop them; **not stated** |
  | `0018` | `section_transfers` | Drop it; **not stated** |

### 4. Data and speed

**Statements per request**, one warm request each, demo data:

| Page | Statements | Repeated reads |
| --- | --- | --- |
| `/today` trainer · vice-dean | 13 · 14 | `notifications` 3, `terms` 2 to 3. Lead review B counted 8; the shell now reads the term on view (4) and the unread announcements (1) |
| `/settings?group=rayat` · `/axes` | 13 · 15 | |
| A term's page · `/rayat` · `/announcements` | 16 · 17 · 17 | the term's calendar 2; `rayat_imports` 2; `notifications` 4 |
| `/terms` | 18, and 3 more per term (M3) | |
| `/framework`, vice-dean or trainer | 26 | `memberships` 3; the term's calendar twice |
| `/sections` head · admin | 28 · 36, and 4 more per department (M3) | |

**Indexes.** `EXPLAIN (ANALYZE)` on `lead_c_scale`:

- **Uses its index:**
  - the version in force: `rayat_imports_term_kind_idx`, 0.137 ms;
  - a term's transfers: `section_transfers_term_idx`, 0.171 ms;
  - the college's breaks: `holidays_days_idx`, 0.106 ms;
  - a person's unread announcements, on every page: `notifications_unread_idx`, 0.156 ms.
- **Reads the whole table on purpose**, because it is small or one import:
  - the term's calendar (6 rows);
  - `countMembers()` (0.6 ms);
  - SF01's records while one import exists (12.1 ms for 21,000 rows; the `import_id` index serves once versions accumulate).
- **Not served:** the announcements' read counts and withdrawal (proposal 4).

**Server p95 in ms**, standalone build, demo data, 60 requests per level after a warm-up, the client on the same 4 vCPU machine:

| Page | 1 | 10 | 20 |
| --- | --- | --- | --- |
| `/today` trainer · vice-dean | 54.4 · 36.7 | 397.2 · 359.1 | 1,081.8 · 1,101.6 |
| `/terms` · a term (vice-dean · trainer) | 45.2 · 56.2 · 45.7 | 313.2 · 579.1 · 407.3 | 1,215.8 · 1,306.5 · 1,260.3 |
| `/axes` | 42.4 | 288.3 | 995.0 |
| `/framework` vice-dean · trainer | 48.0 · 38.7 | 353.4 · 285.9 | 1,140.5 · 898.2 |
| `/rayat` vice-dean · admin · head | 41.6 · 40.9 · 46.1 | 403.2 · 393.2 · 456.0 | 1,148.4 · 1,112.4 · 1,403.5 |
| `/sections` head · admin | 55.6 · 71.0 | 372.7 · 588.0 | 815.3 · 1,216.8 |
| `/announcements` head · dean | 35.7 · 39.3 | 326.7 · 392.0 | 923.1 · 1,301.6 |
| `/settings?group=rayat` | 51.3 | 530.9 | 1,552.7 |

- **At scale, one request at a time** (`lead_c_scale`, 30 requests):
  - `/today` 41.5;
  - `/terms` (13 terms) 66.4;
  - a term 54.0;
  - `/framework` 56.3 and 45.9;
  - `/rayat` 46.8;
  - `/sections` for the head of a 60-section department: 135.4, 409,360 bytes;
  - **`/sections` for the admin at 720 sections: 523.5, 3,900,942 bytes** (proposal 5).
- **Writes.** Real action requests, captured from the screens and replayed (the log counted 182 `axis.update` and 184 `announcement.publish`):
  - an axis's description: 48.8 · 330.3 · 569.4 ms;
  - an announcement to a department: 55.7 · 286.9 · 623.7 ms;
  - an SF01 upload, through the page: 256 to 281 ms for the demo's 767 rows, and 3.4 s for 21,000 rows (proposal 9).
- **Against section 4.**
  - Every read meets 300 ms one at a time on demo data. At scale, the admin's `/sections` does not.
  - Every replayed write meets 1 s at 20 at once. The large SF01 upload does not.
  - At 10 at once, 14 of 16 pages miss the read budget. The load level is the owner's (lead review A's proposal 6).

### 5. Security

- **Permission matrix and audit test.**
  - The section's 25 actions are in both, and both tests find every exported action through `import.meta.glob`. They are:
    - 2 for announcements;
    - 9 for terms and holidays;
    - 1 for the axes;
    - 6 for the framework;
    - 4 for Rayat;
    - 3 for sections.
  - Rayat's actions accept the key held anywhere (ADR-0019) and check it themselves. A section's actions check the key in the section's or the transfer's department. Announcements check it in the scope they reach. Withdrawing another person's announcement needs the key across the college.
- **Inputs.** Every action takes a bounded Zod schema:
  - names and titles 120 to 200 characters, a reason 300, an announcement 1,000;
  - a section reference and an employee number 1 to 40;
  - dates as ISO days, weeks from 1, with each service checking the term's last week;
  - an item's file types the college accepts (Audit 5).
- **Files.**
  - The Rayat upload needs `rayat.import`. The file is read in the action and never kept.
  - Only the mapped columns are read. My synthetic SF01, with names, mobile numbers and grades, left none of them in `rayat_enrollments`, and the integration test checks the schema and the data.
  - The body limit is 10 MB for every action. Inflation is uncapped: the known item above.
- **A note.** The column map decides what is read, and `traineeNumber` takes any text. An admin's map that pointed "رقم المتدرب" at the name's header would keep names. A digits-only check of trainee numbers would refuse that. This is low priority; the admin is trusted.
- **Findings:** none of M1 to M4 is a security finding; the known item above is the only one.

### 6. The section's journeys, counted

Each journey ran on the iPhone 15 emulation of the production build (`lead_c_journeys`), starting from Today.

- "Views" are the pages the phone showed after Today.
- A tap includes the one that focuses a field. The file picker and the keyboard are not counted.
- Every change was made within the 15 minutes `auth.reauthMinutes` allows after the password.

| # | Journey | Role | Views | Taps | Fields | Note |
| --- | --- | --- | --- | --- | --- | --- |
| 1a | Creates and starts an 18-week term with a holiday of its own | vice-dean | 3: `/terms` > `/terms/new` > the term | 20 | 2 (43 characters) | 9 to create it (3 of them months in the picker), 9 to add the holiday, 2 to start it. The college's Eid breaks count by themselves (ADR-0018) |
| 1b | Approves an estimated Eid break | vice-dean | 1: `/terms` | 2 | 0 | |
| 1c | Adjusts an estimated break to its announced days | vice-dean | 1 | 6 | 0 | two days picked |
| 1d | Opens the next term from it | vice-dean | 2: `/terms` > the term | 5 | 1 (25 characters) | the first day and the weeks come filled |
| 2 | Changes an axis's description | admin | 1: `/axes` | 5 | 1 (57 characters) | under "المزيد" |
| 3a | Adds an item for each section's exam and publishes the draft | vice-dean | 1: `/framework` | 18 | 1 (30 characters) | 12 taps are five selects, a stepper and a switch. "نسخة اختبار" had to be chosen with the keyboard (M1). The preview then read "ينشئ 661 مهمة في 3 أقسام" |
| 3b | With endorsement on: starts the version · endorses · publishes | vice-dean · dean · vice-dean | 1 each | 2 · 2 · 3 | 0 | no one is told it is their turn (proposal 7) |
| 3c | Reads the published framework | head · trainer | 1 | 1 | 0 | |
| 4a | Uploads, checks and applies SS01, SF01 and SO01, then rolls SS01 back | vice-dean | 1: `/rayat` | 13 | 0 (3 files) | In one run, the tap on "طبّق الملف" right after the check applied nothing, likely under the check's toast; the measured run waited for the toast to close |
| 4b | Adds the trainer the unmatched report names | admin | 3: `/rayat` > `/people` > `/people/new` | 12 | 3 (40 characters) | the number typed again (proposal 2) |
| 5a | Transfers a section from this week | head | 1: `/sections` | 7 | 2 (25 characters) | under "المزيد"; the card is found by scrolling (proposal 5) |
| 5b | Keeps · cancels a transfer a newer SS01 is in conflict with | head | 1 | 3 · 4 | 0 | nothing tells the head (proposal 3); keeping does nothing when Rayat names a third trainer (M2) |
| 6a | Publishes an announcement to the department | head | 1: `/announcements` | 5 | 2 (85 characters) | |
| 6b | Signs in and reads it | trainer | 1: Today | 3, and 1 to close it | 2 (sign-in) | it opens over Today |

- **Proposals 2, 3, 5, 7 and 8** shorten journeys 4b, 5b, 5a, 3b and 4a. **M1** unblocks 3a and 5a's earlier weeks.
- The other journeys are as short as their outcomes allow:
  - a term's name, days and weeks;
  - one tap to approve a break;
  - an item's fields, which the plan lists;
  - an announcement's title and text;
  - a confirmation where others feel the change (starting a term, rolling back, cancelling a transfer).
- **Touch targets and axe** were covered by the suite's iPhone tests on every screen of the section (all passed), so I did not measure them again. Those checks measure what is on the screen; they cannot see an option that never reaches it (M1).

## Owner items

Unchanged, and I found none of them broken:

- the tags `v0.1-A` and `v0.2-B`;
- the "Production stack" required check;
- the Wi-Fi phone test;
- ADR-0007 and ADR-0010;
- the logo and the font licence;
- SO01's original headers;
- the official list of axes, whose titles are still provisional.

I did not read GitHub.

## How this review left the environment

- **Databases.**
  - The dev database `college` is unchanged. Its `pg_dump`, without pg_dump's random `\restrict` lines, has sha256 `cea938cc…` before and after.
  - `lead_c_checks`, `lead_c_e2e`, `lead_c_trace`, `lead_c_scale` and `lead_c_journeys` were created for this review and dropped. The statement logging was set on two of them only and went with them.
- **Servers.** None is running, and ports 3000 and 3300 to 3302 are free.
  - I stopped my standalone servers by pid.
  - Playwright stopped its own server on 3000.
  - Only `college-dev-postgres-1` runs; Testcontainers left no container.
- **Files my runs rewrote**, all gitignored:
  - `.next/`: `pnpm build`, with `.next/static` and `public` copied into `.next/standalone` as CI does; `check:types` regenerated `.next/types`;
  - `tsconfig.tsbuildinfo`, which `check:types` rewrote;
  - `test-results/` and `playwright-report/index.html`, rewritten by the suite and then restored from copies taken first;
  - `.local/e2e/admin.json` and `trainer.json`, rewritten by the suite's setup project and then restored byte for byte.
- **Throwaway scripts and outputs** live in the session's scratchpad, `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/lc/`:
  - the probes (`probes/`): timing, statement counts, the traces, the journeys, the select probe, the scale files, the workbook probe and the replays;
  - the logs, the statement logs and the screenshots (`kind-select.png`, `week-select-iPhone-15.png`).
- **Repository.** Nothing in it changed except this report.

## Resolution (review/lead-C)

- The fixes are on `review/lead-C`, from `main` at `584319f` (Step 17, then the owner's merges of #19 and #43, both documents only). The `/lead-review` command asks for three things: fix every must-fix item; for each flow proposal the owner accepts, write an ADR and a note under its step before building it; and tag the section on `main` once the pull request merges.
- **The owner's choices, 2026-10-22.**
  - Proposal 1: a task for each trainer of a section, and none for a section without one.
  - Proposals 2, 3 and 5: build them.
  - Proposal 8: not now.
  - Proposal 9: the measured budget.
  - Proposal 7 was not chosen.
- **The ADRs' numbers.** They follow the order of writing, not this report's table:
  - ADR-0020 is the conflict reaching the head (proposal 3), as proposed.
  - ADR-0021 is the sections page for importers (proposal 5), not the endorsement hand-off this report gave that number.
  - ADR-0022 is the trainer added from Rayat's report (proposal 2).
  - ADR-0023 is the budget for imports (proposal 9).

| Item | Disposition |
| --- | --- |
| M1: long selects hide options | **Fixed as proposed.** The shared select's list is bounded to the room on the side it opens to, within the window and every ancestor that clips it (a sheet's scrolling body), less 8 px, at least about three options tall, and scrolls (`overflow-y: auto`). Bounded by the window alone, the desktop's list still ran past the sheet, under its backdrop. The option focus follows scrolls into view. On the iPhone and the desktop, the transfer sheet chooses week 1 by tap or click (sections.spec.ts), and the item sheet chooses "تحليل نتائج" (framework.spec.ts). The provenance file records the local change. |
| M2: a transfer and SS01 drift apart | **Fixed as proposed, with one more state.** `readTransfers(rayat, uploadedAt, transfers)` replaces `trainersInWeek()` and `transferStatus()`. Each trainer Rayat names holds a place in the section, and a confirmed transfer is undone for the weeks before it, the latest first, so those weeks stay the replaced trainer's. A transfer compares with the version's upload time, not its apply time. When the trainer it replaced no longer teaches the section by its week, it is `otherTrainer`: "لا يغيّر شيئًا", explained on the card. The head may cancel it, and a new transfer from the section's trainer now is offered as before. `keepTransfer()` refuses anything but a conflict (`notConflict`). 13 unit cases, including both of this report's traces, and the integration test's sequence (confirmed, another trainer, rolled back, conflict, kept). The note under Step 20 is amended. |
| M3: queries per row | **Fixed as proposed.** `listTermCalendars()` reads every term's calendar in three statements (terms.test.ts counts them). `holdersIn()` reads the transfer candidates of every department shown in one (sections.test.ts counts it). |
| M4: the sections spec off the stack's smoke | **Fixed, with Audit 5's enhancement 1.** `sections.spec.ts` is in `testMatch`, and `tests/unit/stack-specs.test.ts` fails on any spec neither listed nor named outside with its reason. It failed on this spec before the fix. |
| The known item: `readTable()`'s byte budget | **Fixed now.** A workbook's archive is inflated entry by entry, counted, not taken at its declared sizes, and refused past 50 MB. A 25,000-row SF01 inflates to about 17 MB. table.test.ts builds a workbook whose one cell inflates past the budget: refused in under a second, while without the check the reader was still on it after 50 s. The note under Step 40 says so. |
| Proposal 1 | **Built** (the owner's rule, a note under Step 20). `sectionCounts()` gives each department's section trainers and sections without one; `departmentsReached()` counts the trainers; and the preview names the sections without a trainer when an item reaches each section's trainer. The demo's third department has a section with two trainers and one with none, and the exam copy reaches each section's trainer. |
| Proposal 2 | **Built** (ADR-0022). For `people.manage`, the SS01 card's line links to `/people/new` with the number, the department of the first section and the role that completes tasks. `/people/new` fills only a valid number, an active department and a role it offers. rayat.spec.ts follows the link as the admin. |
| Proposal 3 | **Built** (ADR-0020). `pendingTransferChanges()` lists, on the waiting SS01's card, each transfer whose state it would change. The Rayat actions compare the transfers' states before and after an apply or rollback of SS01, and `tellTransferConflicts()` tells the department's holders of `sections.transfer` with the new optional kind `transferConflict`. `/sections` puts those sections first, with a line saying how many. The demo seeds one, and the head of Electrical is told. |
| Proposal 4 | **Built.** Migration `0019` indexes an announcement's notifications by its id. The two queries write the kind out so the planner matches the partial index (notifications.test.ts checks both plans). |
| Proposal 5 | **Built** (ADR-0021). `/sections` opens read-only for `rayat.import`, shows one department at a time to a viewer of several (`?department=`), and filters by reference, course or trainer (`?q=`). sections.spec.ts runs it as the demo vice-dean. |
| Proposal 6 | **Built.** `strandedBySetting()` checks every term not closed before the three settings that count weeks save or reset, and the row says which term and events would leave it. |
| Proposal 7 | Not chosen. **docs/BACKLOG.md.** |
| Proposal 8 | Not now, the owner's choice. **docs/BACKLOG.md.** |
| Proposal 9 | **The budget** (ADR-0023, a row in section 4). rayat.test.ts uploads an XLSX SF01 of 25,000 rows, every column filled, through `readTable()` and `uploadRayat()`, and fails past 5 s: 3.2 to 3.4 s here. The worker alternative stays in docs/BACKLOG.md. |
| Smaller items | **Fixed:** the framework's preview only for whoever prepares the draft; `/sections` and `/framework` share the header's reading of the term's calendar (`termCalendar()`); migrations `0017` and `0018` state their inverse; a role held only for a term that is not active no longer reaches an announcement or a transfer's candidates (announcements.test.ts failed before); `updateHoliday()` takes the college's lock (terms.test.ts shows it waiting); a new item starts on each section's trainer. **docs/BACKLOG.md:** the vice-dean's phone tabs (for UX review 2) and the trainee numbers' digits check. |
| Lead reviews A and B's proposals | Unchanged in docs/BACKLOG.md, with this report's evidence beside them. |
