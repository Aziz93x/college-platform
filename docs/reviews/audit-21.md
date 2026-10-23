# Audit 7: steps 19-21

- Range, in run order:
  - Step 19 `cde2c95 feat: department plan editor (step 19)` (PR #54, ADR-0027).
  - Step 20 `8a3560a feat: the generation engine (step 20)` (PR #50, ADR-0025). It was built beside Step 18 in a second session and merged before Step 19.
  - The owner's notes of 21 October 2026: `b738194 feat: exam periods by week number and due rules anchored to them` (PR #53, ADR-0026). It touches Steps 13, 15, 19 and 20, and this is the first audit to read it.
  - UX review 2 (PR #55, still open, branch `review/ux-20`, `4041019` to `c01d7d7`). It changed Steps 19 and 20's screens, which are judged here as it left them. Its fixes to Steps 11 to 18 are out of range.
  - Step 21: `2f6cb90`, `db5dea1`, `ff967aa` and `ab0794b` on `step/21-assignments` (PR #56, a draft stacked on #55; ADR-0028).
  - Out of range: `8332f36` (#51, ADR-0023's budget test), `f07ea7e` (#52, Audit 6), and everything before.
- Audited on `review/audit-21` at `ab0794b`, a clean tree, on 2026-10-23, by the auditor agent with the karpathy-guidelines skill.
  - The branch is stacked on `step/21-assignments`, because `main` has neither #55 nor #56.
  - The production build in `.next/standalone` was built from `db5dea1`. The later commits change only an end-to-end test and docs.
- **Sources for stated assumptions:**
  - the bodies of PRs #50, #53, #54, #55 and #56, read through GitHub's REST API (read only). #55 has one comment, on the visual baselines; the others have none;
  - the commit bodies, CHANGELOG.md and ADR-0025 to ADR-0028;
  - the plan's notes under Steps 19 to 21;
  - the owner's answers of 23 October recorded in ADR-0028: an assignment's tasks are due once, at its end; an assignment covers one term and grants its role for that term; the six templates are shared.
- **Left out as known:**
  - the `/design` catalog's three visual baselines, missing on purpose until the owner commits CI's. No `@visual` test was run;
  - docs/BACKLOG.md's items for this range:
    - UX review 2's S1 to S6 and "Later";
    - Step 21's two items: Escape in a select's or combobox's list inside a sheet, and telling a person about an assignment;
  - the owner's decisions in ADR-0025 to ADR-0028 and their notes of 21 to 23 October, which are not counted as deviations from older plan text.
- Verdict: **no blockers, 3 major, 7 minor.**
  - **What passes.**
    - `pnpm check:all` passes against an empty database: 124 test files, 1006 tests.
    - knip is clean, and drizzle-kit finds no schema drift.
    - The range's ten specs pass on desktop and iPhone: 179 passed, 19 skipped by device, none failed.
  - **Test coverage.** Every Done-when has a test, and 17 of 20 mutations fail one. Three mutations fail no test:
    - publishing asks for `plan.edit`;
    - revoking an assignment queues no pass;
    - changing a template's items queues no pass.

    The fast-check property meant to prove "never changes completed work" lets its mutation through. An example test catches it.
  - **Major 1.** `/plan` refuses a role that holds `plan.publish` without `plan.edit`. The split that ADR-0027 names then leaves the department's plan with no one able to publish it.
  - **Major 2.** The 50-item usability run cannot fail: its 30-minute bound is also its timeout, and it takes 24 s. It changes one field an item, so it does not measure a head's time.
  - **Major 3.** A draft term counts the active term's people. A role held for one term reaches a draft next term's items, previews and assignments, and a role held for the next term only reaches none of them until the term starts.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all`, `DATABASE_URL` on the empty `ci_empty` as CI has it, `TESTCONTAINERS_RYUK_DISABLED=true` | exit 0 in 155 s · `Checked 684 files in 836ms. No fixes applied.` · `Test Files  124 passed (124)` · `Tests  1006 passed (1006)` · `check:hardcode passed.` · `✔ no dependency violations found (581 modules, 2721 dependencies cruised)`. The log shows the known `DeprecationWarning` from pg |
| `pnpm check:unused` · `drizzle-kit generate` on a scratch copy of HEAD (`git archive`) | knip exit 0 · `No schema changes, nothing to migrate` |
| `ux20-e2e-all.sh` (drop and reseed `college`, then Playwright with `CI=1` on the build, desktop and iPhone, without `@visual`): plan, assignments, framework, terms, audit, shell, roles, rayat, sections, design | `seed:demo finished with --seed 42 --week 9` · `Running 198 tests using 2 workers` · `19 skipped` · `179 passed (5.9m)` · exit 0 in 378 s. Each skip comes from one of the specs' eleven `test.skip` calls for a phone, a desktop or a touch screen |
| The same script, the 50-item run alone on desktop, `--reporter=list` | `✓ 3 [desktop] › e2e/plan.spec.ts:364:1 › a head builds a 50-item plan in well under 30 minutes … (24.2s)` |
| A fresh database `audit21`: `db:migrate`, `db:seed`, `seed:demo`; then read-only SQL | Probes D1 to D4 below |

**Probes.** Each ran in the scratch copy as a throwaway test, against the current build, or as SQL on the fresh demo seed. The sources are in the scratchpad (see the last section).

| Probe | Result |
| --- | --- |
| P1, integration: Salem holds Electrical's secretary role for every term. He is given the secretary's template, which is then revoked | `"granted":true` · two secretary memberships while assigned (`[{"forTerm":false},{"forTerm":true}]`) · after the revocation `membershipRemoved` is sent and `membership.delete` written · `"keysAfterRevoke":true` (minor 3) |
| P2, integration: a draft 18-week next term beside the active one. Noura holds Electrical's trainer role for the next term only; Salem holds its secretary role for the active term only | `{"assignNouraInNextTerm":{"status":"notMember"}, "roleHoldersCountedForAnyTerm":["hind:trainer","salem:secretary","salem:trainer"]}` (major 3) |
| P3: `framework.generation.done` rendered with next-intl for each cause | `plan → 33 مهمة في الفصل، وُلِّدت بعد نشر خطة قسم …` · `assignment → 33 مهمة في الفصل، وُلِّدت في المراجعة الليلية …` (minor 4) |
| P4, end to end on the current build: a role of the test's own holding `plan.publish` alone, held in Electrical, opens `/plan` | `PROBE {"forbidden":true,"planLinks":0}` (major 1). The probe removed its role and its account |
| P5: the generators of tests/unit/generation.test.ts's second property, sampled 20,000 times (seed 42). How many cases have a started or finished task whose slot the second version calls for again, with other words, week or policy? | `finishedWorkCalledForWithNewWords=20 startedWorkCalledForWithNewWords=22` (minor 1) |
| P6: the same property with `numRuns: 3000`, under mutation S20-M1 | fails at the 218th run, on a `returned` task whose week changed. At the default 100 runs it passes |
| P7: the permission matrix with one more role, holding every key but the row's | `Tests  66 passed (66)` on HEAD. Under S19-M5: `publishPlanAction …` fails with `"every key but this one across the college: allowed"` (enhancement 1) |
| D1: the fresh seed's tasks by source | 832 live tasks: 692 from the framework, 107 from the two published plans (64 exam copies, 23 general, 12 homework, 8 minutes), and 33 from 6 assignments, held by 6 people. 14 wait for the visiting trainer |
| D2: Electrical's tasks that ask for the head's approval, by week (framework and plan) | 56 over 18 weeks, which the preview words as about 3 a week ("نحو 3 مراجعات في الأسبوع"). By week: 22 in week 15, 11 in each of weeks 4, 10 and 16, 1 in week 17, and none in the other 13 weeks (enhancement 2) |
| D3: the secretary role and its holders | One secretary in each department, each holding the role for the term through the secretary's assignment. The seeded role holds no key (`secretary \| {NULL}`; db/seed/base.ts:69) |
| D4: the seed's one generation pass | `framework \| done \| 832 \| 832 \| 0.320` (seconds) |

**Mutation checks.** Each mutation was applied to the scratch copy, which has its own git baseline; the named tests ran there; then the file was restored and checked (`restored (same as baseline)` each time). Before any mutation, the copy's unit baseline gave `Test Files  6 passed (6)` and `Tests  113 passed (113)`.

| Mutation | Result |
| --- | --- |
| S20-M1: `reconcile()` rewrites any task whose words changed, started or finished work too (`generate.ts:310`) | generate.test.ts:275 "leaves started and finished work where it is, …" fails. The fast-check property in tests/unit/generation.test.ts:269 **passes** (P5, P6) |
| S20-M2: the slot key without the place (`generate.ts:62-79`) | 4 fail, both properties first |
| S20-M3: a course's item counted per section (`count.ts:108`) | count.test.ts and the property "makes as many tasks as the preview counts" fail |
| S19-M7: a plan's items in every department (`generate.ts:108`) | generate.test.ts's "gives a department plan's item slots in its own department only …" and the property fail |
| S19-M1: a published version takes changes (`plans.ts:309`) | department-plans.test.ts: 3 fail, "starts as an empty draft, …" first |
| S19-M2: the wizard without `copyPlansInto()` (`terms/actions.ts:103`) | actions-audit.test.ts: 2 fail |
| S19-M3: the engine reads the latest version, draft or not (`plans.ts:177`) | department-plans.test.ts and generation.test.ts **pass**. seed-demo.test.ts:743 fails, through the demo's Electrical draft |
| S19-M5: `publishPlanAction` asks for `plan.edit` (`plan/actions.ts:191`) | permission-matrix.test.ts **passes**: every seeded role that holds one of the two keys holds both (major 1, enhancement 1) |
| S21-M1: `assign()` grants no role (`assignments.ts:199`) | assignments.test.ts: 2 fail |
| S21-M2: a revocation keeps the membership (`assignments.ts:275`) | assignments.test.ts:180 fails |
| S21-M3: the engine without `assignedItems()` (`tasks/server/generate.ts:63`) | assignments.test.ts: 2 fail |
| S21-M4: every assignment is due in the term's last week (`assignments/domain/inputs.ts:28`) | assignments.test.ts:305 fails |
| S21-M5: `assign()` takes someone with no role in the department (`assignments.ts:165`) | assignments.test.ts:379 fails |
| S21-M6: `assignAction` asks for its key across the college (`assignments/actions.ts:66`) | permission-matrix.test.ts: `assignAction` fails |
| S21-M7: `revokeAssignmentAction` queues no pass (`assignments/actions.ts:96`) | actions-audit.test.ts and assignments.test.ts **pass** (minor 2) |
| S21-M8: `regenerate()` queues nothing (`assignments/actions.ts:56-60`) | the same two files **pass** (minor 2) |
| P26-M1: two periods sharing a week pass (`periods.ts:36`) | periods.test.ts fails |
| P26-M2: "before a period" counts from its last week (`count.ts:76`) | count.test.ts: 4 fail |
| P26-M3: activation ignores the periods (`terms.ts:358`) | terms.test.ts: 2 fail |
| P26-M4: saving the periods queues no pass (`terms/actions.ts:165`) | actions-audit.test.ts: 2 fail |
| Not run, found by reading: the plan page's preview counted over every department, or the assignments page made editable on a closed term | No test reads the preview's numbers (e2e/plan.spec.ts:128-129 and `:335` match only "^تُنشئ المسودة" and "في الأسبوع:"). No spec opens a closed term on `/assignments` (minor 5) |

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 19 | A scripted usability run builds a 50-item plan in under 30 minutes | **not proven for a person** | e2e/plan.spec.ts:364 builds 50 items in 24.2 s. Its bound (`:401`) equals its timeout (`:369`), so it cannot fail. Each item changes only its title (major 2) |
| 19 | Publish previews use the shared counting function | proven in code and against the engine; not on the page | page.tsx:174-177 counts with `countTasks()`. seed-demo.test.ts:743 checks each published demo plan's preview against its tasks, through support/preview.ts's `planPreview()`, a copy of the page's reads; S19-M3 fails it there. No test reads the page's numbers (minor 5) |
| 19 | Versions cannot be edited | proven | department-plans.test.ts:161: adding, changing, moving, removing and publishing on a published version each answer `notDraft`. S19-M1 fails it |
| 19 | The Step 13 wizard copies the plan as a draft | proven | department-plans.test.ts:498, and actions-audit expects `plan.create` from `openNextTermAction`. S19-M2 fails it |
| 20 | fast-check proves generation idempotent | proven | tests/unit/generation.test.ts:269 runs every case twice. S20-M2 fails it |
| 20 | … and that it never changes completed work | proven by an example test, weakly by the property | generate.test.ts:275 fails under S20-M1; the property does not (minor 1) |
| 20 | For every demo framework and plan, the published preview equals the tasks generated | proven | seed-demo.test.ts:743: the framework's preview, plus both plans' previews, plus the assignments' items, equals the pass's 832 created tasks. S20-M3 fails the property; S19-M3 fails the seed test |
| 20 | Generation for the full demo data set takes under 10 s | proven | The seed test asserts `run.seconds < 10`. The fresh seed's pass made 832 tasks in 0.320 s (D4) |
| 21 | Assigning the secretary template grants the secretary permissions | proven, with a key of the test's own | assignments.test.ts:180; S21-M1 fails it. The seeded secretary role holds no key (D3), so the test gives it `announcements.publish`. The end-to-end test checks the membership in the database |
| 21 | Revoking it removes them | proven, except for a secretary for every term | `:180`; S21-M2 fails it. A secretary for every term is told the role was removed although they keep it (minor 3) |
| 21 | The template's tasks exist for the assignee | proven | assignments.test.ts:305; S21-M3 and S21-M4 fail it. The demo has 33 such tasks (D1) |

The owner's notes of 21 October have no Done-when of their own. Their tests:
- the periods' errors: P26-M1;
- the anchored rule's weeks: P26-M2;
- the activation's refusal: P26-M3;
- the pass a save queues: P26-M4;
- migration `0022` on a database of `0021` (exam-periods-migration.test.ts);
- the vice-dean's journey end to end (terms.spec.ts:121).

**Plan rules.**

- **Hardcoded values.**
  - `check:hardcode` passes. The range adds no Arabic under `src/` outside tests, and no role key.
  - The six templates, their items and the axis code `9` are base-seed data (db/seed/base.ts:211).
  - The constants in code are guards or timings:
    - `assignmentLimits.people` (500);
    - `INSERT_BATCH` (500);
    - a run left for 15 minutes is taken over;
    - `/framework` re-reads a pass every 3 s.
- **Permissions by key.**
  - `plan.publish` and `assignment.manage` come back with the steps that check them, as section 0 says.
  - The base seed gives both to the head, and so do migrations `0023` and `0026` for existing colleges, by role key. That is seed data, and seed-base.test.ts checks both.
  - `offered()` refuses a role by its `system` flag, not its name.
  - Missing: a holder of `plan.publish` alone (major 1).
- **Server actions.**
  - Step 19 adds six actions (`startPlan`, `addPlanItem`, `updatePlanItem`, `movePlanItems`, `removePlanItems`, `publishPlan`). ADR-0026 adds `saveExamPeriods`. Step 21 adds eight: `assign`, `revokeAssignment`, and three actions each for templates and template items.
  - Each runs through `viewerAction` with a Zod schema and its key in the department of what it changes.
  - Each has its row in the permission matrix and its line in actions-audit.test.ts, and both guards ("every action is in the matrix", "is every action of every action module, each run here") pass.
  - Steps 20 and 21 make the framework, Rayat, sections, terms, plan and assignment actions queue passes. Only some of those are tested (minor 2).
- **Audit events.**
  - New events: `plan.*`, `planItem.*`, `examPeriods.update`, `assignmentTemplate.*`, `assignmentTemplateItem.*` and `assignment.create` and `.revoke`. Each pass that changes tasks writes `task.generate`, by the system.
  - A grant and a revocation write `membership.create` and `membership.delete` beside the assignment's own event.
  - A move or a save that changes nothing writes nothing.
  - Each new entity has its subject in the log: describe.test.ts's guard requires one per entity, and it passes.
- **Screen states.**
  - `/plan`:
    - loading: `plan/loading.tsx`, shaped like the page, with no text;
    - empty: no term; no department; no version yet, with Start and the copy of the previous term's plan; a draft with no items;
    - partial: the framework not yet published; the department's sections not in SS01 yet; a publisher needed; a draft beside the published version; flagged items;
    - error: the `(app)` error boundary, and each refusal in an alert;
    - no permission: `forbidden()` and no shell item for a trainer (plan.spec.ts:458). A publisher without `plan.edit` gets the same (major 1);
    - a closed term is read-only (`:408`), and axe and the 44 px check run on desktop and iPhone.
  - `/assignments`:
    - loading: `assignments/loading.tsx`;
    - empty: no term; no department; a template given to no one; a template with no items; no one left to give it to;
    - error and refusals as on `/plan`;
    - no permission: `forbidden()` and no shell item (assignments.spec.ts:366);
    - the closed term's read-only list has no test (minor 5).
  - The exam periods card on `/terms/[id]` shows its two errors as the vice-dean steps, saves through `SaveActions`, and is read-only for everyone else. `/framework`'s generation card shows a pass waiting, running with its progress, done, failed, or none yet.
- **Demo data** (the fresh seed).
  - **Plans:** Electrical's version 1 is published (6 items) and its version 2 is a draft in the making (8). Mechanical's version 1 is published (3). General Studies has none, which shows the empty state.
  - **Assignments:** a secretary in each department by the secretary's template. Electrical also has a safety supervisor for the term, a schedule coordinator for weeks 1 to 4, and its own inventory officer for weeks 13 to 18. Together: 33 tasks for 6 people (D1).
  - **Exam periods:** weeks 5–6, 11–12, 16 and 17–18.
  - **Tasks:** 832, every one not started, as nothing can start a task before Step 26.
  - Missing: a flagged draft item, which UX review 2's S4 already lists.
- **Isolated network and components.**
  - Nothing new is fetched or shipped.
  - One new BeUI component, the multi select (minor 6).
  - `plan.spec.ts` and `assignments.spec.ts` join the stack's smoke, and `stack-specs.test.ts` passes.
- **Migrations `0021` to `0026`** each state their inverse.
  - Tests: `0022` (exam-periods-migration.test.ts), `0023` and `0024` (department-plans-migration.test.ts), `0025` (navigation-order-migration.test.ts), and `0026`'s grant (seed-base.test.ts).
  - `0024` drops `section_templates` after `0023` moved its rows into first drafts, with their ids.

## Karpathy guidelines

1. **Think before coding: stated in four ADRs, with seven silent choices.**
   - **Step 20** (#50, ADR-0025) states eight decisions, among them:
     - a task is keyed by its place;
     - "no evidence" reads as "not started";
     - every occurrence is generated at once;
     - a task is due on the week's last working day;
     - passes run in the worker.

     The owner's rule for a course's task through a transfer (23 October) is recorded under Step 20. Silent: whom a draft term's items reach (major 3).
   - **The owner's notes** (#53, ADR-0026). The questions put to the owner on 23 October went unanswered, so the PR builds the defaults it stated to them and lists what it leaves out:
     - no editor of the types;
     - no weekday of a rule's own;
     - the canvas's grade deadline anchored to the periods.
   - **Step 19** (#54, ADR-0027) records the design stated to the owner when the step started. Silent:
     - who publishes when `plan.edit` and `plan.publish` part (major 1);
     - what "a scripted usability run" measures (major 2);
     - an empty draft is never published (plans.ts:546), so a department cannot take all its own items back for the rest of a term.
   - **Step 21** (#56, ADR-0028) asked the owner three questions and recorded the answers. Silent:
     - the multi select over a list of checkboxes, after the owner's rule of 22 October (minor 6);
     - a secretary for every term who is given the template (minor 3);
     - a range of weeks already over is accepted, and its tasks are overdue at once: the demo's schedule coordinator, weeks 1 to 4, is given in week 9.
2. **Simplicity: proportionate, except the multi select.**
   - **Step 20** adds about 1,670 lines of code and 1,720 of tests.
     - The engine is a pure domain (slots, wanted tasks, `reconcile()`: 331 lines), a service (390) and its runs (150).
     - One idea, the place, serves sections, courses and transfers, and Step 17's `transferTasks()` went.
   - **The owner's notes** add about 1,130 lines. The term page's card repeats `periodProblems()`'s overlap test in the client (exam-periods.tsx:76-87), a dozen lines.
   - **Step 19** adds about 3,400 lines and removes 1,370.
     - One list of items replaces templates kept beside a plan.
     - The item sheet and its words stay shared with the framework.
     - `departmentsReached()` replaced `countMembers()`, and the orphan went with it.
   - **Step 21** adds about 4,400 lines.
     - The multi select is 838 of them, and half of it is the combobox's (minor 6).
     - The item sheet's `assignment` flag hides four fields for a second user.
     - `deleteMembership()` was extracted when it gained a second caller.
     - `termAssignments()` returns `granted`, which only the tests read; minor 3's fix needs it.
3. **Surgical changes: good.**
   - **Step 20** touched the Rayat, sections and framework actions only to queue passes. Step 17's `transferTasks()` and its tests went, as ADR-0025 says.
   - **Step 19** replaced `/templates` with `/plan`. The layout and the Rayat, sections and framework pages changed only to show a draft term to `plan.edit` (ADR-0027, decision 8).
   - **Step 21** took the demo's secretary memberships out of people.ts, history.ts and terms.ts, as Step 10's note asks. `ab0794b` only adds the page to the admin's phone pages.
   - **UX review 2's** changes to `/plan`, `/framework` and the item sheet trace to its F2, F5, C1 and C3.
4. **Goal-driven execution: strong in the services, weak where a goal is a person's time or a test's power.**
   - 17 of 20 mutations fail a test. S19-M5, S21-M7 and S21-M8 fail none.
   - The usability run's bound cannot fail (major 2).
   - The property behind "never changes completed work" seldom reaches that case (minor 1).
   - The pages' preview numbers are never read (minor 5).

## Findings

### Blocker

None.

### Major

**1. `/plan` refuses a role that holds `plan.publish` without `plan.edit`. When the two keys part, as ADR-0027 foresees, no one can publish the department's plan.**

- **Where.**
  - `src/app/(app)/plan/page.tsx:56-57` calls `forbidden()` for anyone without `plan.edit`, and `:104-106` lists only the departments where the viewer holds it.
  - `src/app/(app)/_shell/navigation.ts:138-141`: the plan item asks for `plan.edit` alone.
  - `src/app/(app)/_shell/term.ts:16-24`: `preparesTerms()` shows draft terms for `plan.edit` alone.
  - `src/app/(app)/plan/plan-editor.tsx:355-381` draws Publish only inside the draft's editing controls.
  - `publishPlanAction` itself checks `plan.publish` (plan/actions.ts:191), so the server would publish. The page offers no way to ask it.
- **The decision it breaks.**
  - ADR-0027's last consequence: "A department whose head holds `plan.edit` without `plan.publish` prepares its plan, and someone who holds the key publishes it."
  - Such a head reads "ينشر الخطة من يملك صلاحية نشر خطة القسم." (`plan.needsPublisher`).
  - Probe P4: a role holding `plan.publish` alone in Electrical gets `{"forbidden":true,"planLinks":0}`.
  - A college that asks the vice-dean to approve departments' plans would set up exactly this, and its plans would never be published or generate tasks.
- **Why no test fails.**
  - No test has a role holding one of the two keys without the other.
  - The permission matrix's roles hold both or neither, so S19-M5, which makes publishing ask for `plan.edit`, passes all 66 rows.

Fix:
- Open `/plan` for `plan.edit` or `plan.publish`: the navigation item and `preparesTerms()` with both keys, and the departments where the viewer holds either.
- Give the editor an `edits` flag apart from `publishes`. A publisher without `plan.edit` then reads the draft, its preview and its flags, and publishes it, but adds, moves and removes nothing.
- Add an end-to-end test with a role that holds `plan.publish` alone.
- Enhancement 1 makes the matrix tell the keys apart.

Cost: 45 min.

**2. The 50-item usability run cannot fail, and it does not measure a head.**

- **Where.**
  - e2e/plan.spec.ts:364-406. `test.setTimeout(30 * 60_000)` (`:369`) and `expect(Date.now() - started).toBeLessThan(30 * 60_000)` (`:401`): the bound equals the timeout, so the test times out before its assertion could fail.
  - Alone on desktop, the whole test takes 24.2 s, sign-in and publishing included.
- **What it does.**
  - Each item: type a title, then press "حفظ وإضافة آخر". Every fifth item also presses the week's "more" once.
  - The sheet keeps every other field from the item before, so all 50 items share one axis, kind, reach and evidence policy, and a week rule.
- **What a plan takes.**
  - The demo's Electrical items differ:
    - in axis and kind;
    - in reach: each course's trainer, each section's, the secretary, one person;
    - in rule: a week, every 4 weeks, anchored to the periods;
    - in evidence: types, files, approval.
  - The practical exam's copy alone takes about 25 presses and 65 typed characters. The week stepper takes 14 of those presses to reach week 15, which UX review 2's S4 also notes.
  - At the keystroke-level model's usual times, that is about a minute for the item: 1.1 s to point and 0.1 s to press, 0.28 s a character, and 1.35 s to decide each field.
  - Whether 50 such items fit in 30 minutes is the step's goal ("a head builds the term plan in under 30 minutes"), and nothing measures it.

Fix:
- In the test:
  - cycle the demo Electrical plan's kinds of item, each setting its own axis, kind, reach, rule and evidence;
  - count every fill, press and character the run makes;
  - assert the modelled time is under 30 minutes;
  - keep a wall-clock bound that can fail (for example 5 minutes) under a longer timeout.
- For the owner: a timed session in which a head builds a plan from a printed script, as a "You:" item, for example in Step 46's acceptance test.
- Offering the term's weeks in a select (S4) shortens the run that measures this.

Cost: 1 h for the test.

**3. A draft term counts the active term's people.**

- **Where.**
  - `roleHolders()` (src/modules/access/server/members.ts:18-42) counts a role held for one term "while that term is active" (`inForce`, `:10-13`), whatever term it is asked about.
  - It is the one list read by:
    - the engine (src/modules/tasks/server/generate.ts:64);
    - the plan's preview (`src/app/(app)/plan/page.tsx:128`);
    - a plan item's check of its person (src/modules/planning/server/plans.ts:343);
    - the assign service (src/modules/assignments/server/assignments.ts:160-164);
    - the assignments page (`src/app/(app)/assignments/page.tsx:103`).
- **Why the range makes it matter.** The term's turnover now runs through this path:
  - `plan.edit` shows the next term while it is a draft, and its plan may be published there, which queues a pass (ADR-0027, decision 8);
  - the engine runs over every term not closed, drafts included (runs.ts:27-31, generate.ts:319);
  - the secretary's role is now held for one term, by assignment (ADR-0028).
- **Probe P2.**
  - Noura, who holds Electrical's trainer role for the next term only, cannot be given a template there: `notMember`.
  - Salem, Electrical's secretary for the active term only, is counted for any term: `"salem:secretary"`.
- **What follows before the next term starts.**
  - Its plan's items for a role reach those who hold the role for this term only, and miss those who hold it for the next term only. Holders for every term are counted right. In the demo, every secretary holds the role for this term only, so the next term's minutes would go to this term's secretaries.
  - Its preview counts the same wrong people.
  - The next term's newcomers can be neither named in a plan item nor assigned.
  - The first pass after the term is activated, the nightly one, cancels the wrong tasks that were not started and makes the right ones. Until Step 24 shows tasks, no one sees the wrong ones.

Fix:
- Give `roleHolders()` the term: a membership counts for it when its `term_id` is null or is that term.
- Pass the term from:
  - `termInputs()`;
  - the plan's and the assignments' pages (the term on view);
  - `offered()` (the draft's term);
  - `assign()` (`input.termId`).
- Keep `inForce` for what a person may do now (`loadAccess()`).
- Add an integration test with a draft next term: a role held for that term only is reached and assignable there, and one held for the active term only is not.

Cost: 45 min. Step 22's board and Step 24's work list then read the right people too.

### Minor

**1. The fast-check property seldom reaches "never changes completed work".**
- **Where.** tests/unit/generation.test.ts:269-336.
- **Why.**
  - Its two versions (`first`, `second`) and its two reaches (`departments`, `changed`) are drawn independently (`:78-122`, `:272-284`). So a started or finished task's slot is rarely called for again with other words.
  - P5: that happens in 20 cases of 20,000 for finished work and 22 for started work, about 0.1%, or about one run in ten at fast-check's 100 cases.
  - S20-M1 passes the property, and the example test at generate.test.ts:275 is what catches it.
- **The Done-when** names the property as the proof.

Fix:
- Derive `second` from `first` (keep, reword, move or drop each item; add a few) and `changed` from `departments`.
- Count the cases that reach the claim with `fc.statistics`, or assert a share of them.

Cost: 30 min.

**2. Revoking an assignment, and changing a template's items or axis, queue a pass that no test checks.**
- **Where.**
  - `src/app/(app)/assignments/actions.ts:96` and `regenerate()` (`:56-60`), called at `:139`, `:180`, `:204` and `:220`.
  - actions-audit.test.ts checks `queued()` only after `assignAction` (`:780`). The template whose items it changes is not assigned, so `regenerate()` has nothing to queue.
- **Effect.** S21-M7 and S21-M8 fail no test. ADR-0028 lists all four changes as queuing a pass.

Fix: assign the department's own template before changing its items, and expect `"assignment"` after each item change and after the revocation. Cost: 15 min.

**3. A secretary for every term who is given the secretary's template gets a second membership, then is told they lost the role, which they keep.**
- **Where.**
  - `assign()` (assignments.ts:199-221) relies on `insertMembership()`'s `onConflictDoNothing()` (access/server/roles.ts:426).
  - `memberships_scope_unique` (access/server/schema.ts:77-79) includes the term, so a row held for every term does not conflict with one held for this term.
- **Probe P1.**
  - `"granted":true`, two memberships while assigned, `membershipAdded`;
  - after the revocation, `membership.delete` and `membershipRemoved`, while `"keysAfterRevoke":true`.
- **Also.**
  - The revoke sheet says "ويُسحب منه دور أمين القسم في القسم." to every holder of a template that grants a role (assignments-board.tsx:239-244).
  - `termAssignments()` already knows whether this assignment granted the role (`granted`, assignments.ts:65), but the page drops it (page.tsx:149-161).
  - The test "leaves the role to someone who already held it for the term" (assignments.test.ts:281) uses a membership for the term only.
- **The rule.** ADR-0028 says someone who already held the role "keeps it: the assignment adds nothing, and its revocation removes nothing".

Fix:
- Before granting, look for the role in the department, held for every term or for this one.
- Pass `granted` to the board, so the sheet names the role only when this assignment gave it.
- Add the every-term case to `:281`.

Cost: 20 min.

**4. A pass caused by an assignment reads "in the nightly pass" on `/framework`.**
- **Where.**
  - messages/ar.json:1910: `framework.generation.done`'s `{cause, select, …}` has no `assignment` branch. Step 21 added the cause to `audit.causes` (`:1549`) only.
  - framework/page.tsx:196 passes `run.reason`.
  - P3: `assignment → … وُلِّدت في المراجعة الليلية …`.
  - `queued` and `none` (`:1906`, `:1905`) say "من الإطار المنشور" for a plan's or an assignment's pass too.

Fix:
- Add `assignment {بعد تكليف أو إلغائه أو تعديل قالبه}`.
- Drop "من الإطار المنشور" from `queued` and `none`.
- Enhancement 3 keeps the next cause from missing its words.

Cost: 10 min.

**5. The plan page's preview numbers, and the assignments page's closed term, have no test.**
- **Where.**
  - e2e/plan.spec.ts:128-129 and `:335` match only "^تُنشئ المسودة" and "في الأسبوع:". A page that counted every department, or the draft's items twice, would pass.
  - assignments.spec.ts opens no closed term. Removing `editable` (page.tsx:189) would offer Assign and Revoke there, which the service then refuses, and no test would fail.
  - `/plan` has its closed-term test (plan.spec.ts:408), and Audit 6's minor 3 asked the same of `/templates`.

Fix:
- In the draft-term test, expect the publish dialog's count to equal the tasks the pass makes once the draft is published.
- In assignments.spec.ts, open a closed term of the test's own: it lists its holders and offers no Assign or Revoke button.

Cost: 30 min.

**6. The multi select is a new BeUI component whose pull request does not say why, as the owner's rule asks, and half of it copies the combobox.**
- **The rule.** docs/PLAN.md:59 (22 October): "A new BeUI component comes in only for something none of these can do, and its pull request says why."
- **What the PR and the docs say.**
  - PR #56 says it was "copied as the combobox was".
  - docs/design/beui-map.md:131-133 explains why it is not a combobox option. It does not say why the Motion checkbox, as a list filtered by a search field, cannot choose several of a department's dozen or so people.
- **The copy.** 838 lines in five files:
  - `multi-select/content.tsx` is `combobox/content.tsx` with only renames (11 diff lines of 118);
  - `list.tsx` differs in 31 of 165 lines, and `context.tsx` in 129 of 313;
  - UX review 2's `e65a123` fixed the combobox's panel and the copy carries the fix, but the next fix to one must be made in both.

Fix:
- Put the question to the owner in PR #56, with the reason.
- Whatever the answer, share one panel (`content.tsx`) between the combobox and the multi select.

Cost: 10 min for the question; about 1 h to share the panel.

**7. Step 21's copy: two sentences name roles a college may rename, and "everyone already holds it" shows in a department with no one in it.**
- **Where.**
  - messages/ar.json:2262 ("…يكلّف بها رئيس القسم منسوبيه…") and `:2265` ("…ويضيفه وكيل التدريب…") follow the pattern UX review 2's S3 asks to drop, written after that review.
  - assign-sheet.tsx:188 shows `everyone`, "كل منسوبي القسم مكلَّفون به في هذا الفصل.", whenever the list is empty, including for a department with no people.

Fix:
- Name the key's holder, as `plan.needsPublisher` does: "…يكلّف بها من يملك إسناد التكليفات في القسم…" and "…ويضيفه من يدير الفصول التدريبية…".
- Show `everyone` only when the department has people; otherwise say that the department has no one yet.

Cost: 10 min.

## Enhancements (at most 3)

1. **A matrix role holding every key but the action's.**
   - `mismatches()` in permission-matrix.test.ts adds one role per row: `permissionKeys` without the row's own key.
   - Probe P7: all 66 rows pass on HEAD, and S19-M5 fails with "every key but this one across the college: allowed".
   - Benefit: catches an action that checks the wrong key of a pair the default roles always hold together: `plan.edit` and `plan.publish` today, and the keys Steps 22 and 29 add next.
   - Cost: 10 min.
2. **The review load names its busiest week.**
   - The publish dialog adds "أكثرها N في الأسبوع W" to "نحو N مراجعات في الأسبوع", from the weeks `dueWeeks()` already gives.
   - In Electrical (D2), the average reads about 3 a week, while week 15 asks 22 and 13 weeks ask none.
   - Benefit: the head sees the exam weeks' load before publishing, which is what the preview is for.
   - Cost: 30 min.
3. **A guard on a pass's causes.**
   - A unit test that every `GenerationReason` has its words under `audit.causes` and its own branch in `framework.generation.done`.
   - Benefit: Step 22's quick request, a new source and cause, gets its words in its own pull request. It would have caught minor 4.
   - Cost: 15 min.

## Planning observations (not defects of Steps 19-21)

- **The secretary's grant has no keys to give yet.** The seeded secretary role holds no key (db/seed/base.ts:69), so the grant changes nothing a person may do until a step gives the role its keys; ADR-0028 names Step 33. Until then, its visible effect is reach: the plan's items for the secretary.
- **Two silent choices for the owner:**
  - an empty draft is never published, so a department cannot take its own items back for the rest of a term;
  - an assignment whose weeks are over is accepted, and its tasks are overdue at once.
- **Major 3's fix serves later steps.** A term-aware list of role holders is what Step 22's readiness board and Step 24's work list need too.

## How this audit left the environment

- **Database `college`.**
  - The e2e script dropped and reseeded it twice: for the ten specs, then for the 50-item run.
  - It holds that last demo seed and what the 50-item run left. That test removes its own term, tasks, passes and plans.
  - Probe P4 removed its role, and the account fixture removed its account; a check after the probe found no `probe-%` role and no `e2e.%` user.
- **Database `audit21`.** I created it for the read-only probes D1 to D4, from `db:migrate`, `db:seed` and `seed:demo`, and dropped it at the end.
- **Database `ci_empty`.** It served as `check:all`'s `DATABASE_URL`, and it is still empty (0 tables).
- **Docker.** Only `college-dev-postgres-1` runs; Testcontainers left no container behind.
- **Servers.** None is running, and port 3000 is free.
- **Files.**
  - `check:types` rewrote `.next/types`.
  - The e2e runs rewrote `test-results/` and `.local/e2e/*.json`. All are git-ignored.
  - Nothing was built: `.next/standalone` is still `db5dea1`'s build.
- **Scratchpad.** Everything this audit made is in `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/a21/`:
  - the logs (`checkall.log`, `knip.log`, `e2e.log`, `e2e-50.log`);
  - the PR bodies (`prs/`);
  - the scratch copy of HEAD with its own git baseline (`copy/`);
  - the mutation runner and one log per mutation (`tools/`);
  - the probes' sources (`probes/`).
- **Repository.** Nothing changed except this report, which is not committed.

## Resolution (review/audit-21)

- Branch `review/audit-21` from `step/21-assignments`, 2026-10-23: the tree the audit judged, with Step 21's fix for minor 6 merged in (below). It stays stacked on #56, which is stacked on #55, until both are on `main`; then it takes `main` and goes to `main` itself.
- The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor gets a disposition here.
- `seed:demo` does not change.

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: `/plan` refuses a holder of `plan.publish` alone | **Fixed as proposed.** The page opens for either key, and lists the departments where the viewer holds either. The navigation item asks for either key. `preparesTerms()` shows a draft term to either. The editor takes `edits` apart from `publishes`: a publisher without `plan.edit` reads the draft, its preview and its flags, and publishes it, but adds, moves, removes and starts nothing, and reads "يبدأ الخطة ونسخها الجديدة ويعدّها من يملك صلاحية تحرير خطة القسم." where the editor's buttons would be. plan.spec.ts adds a role of the test's own that holds `plan.publish` alone in General Studies: it reads the head's draft and its preview, publishes it, and is offered no next version. Enhancement 1 makes the permission matrix tell the keys apart. | `fix: role holders by term, plan.publish alone on /plan, a usability run that can fail, and the audit's minors (audit 7)` |
| Major 2: the usability run cannot fail and measures no one | **Fixed as proposed.** The run builds a plan of the demo's five kinds of item, ten of each: every item sets its own title and week, and the first of each kind its axis, kind, reach, file type, file count and approval, which the sheet keeps for the next nine. Each fill, choice, press and step is counted by the keystroke-level model (1.35 s to decide, 1.1 s to point, 0.2 s to press, 0.28 s a character), and the modelled time must stay under 30 minutes; it reads 13.0 minutes for the 50 items. The scripted run itself must finish within 3 minutes, under a 4-minute timeout, so the bound can fail and a run that stalls fails within CI's job. Each kind's tenth item is checked for its kind's reach, so the sheet's keeping is what the model counts on. The owner's timed session with a real head is a note under Step 46. | same commit |
| Major 3: a draft term counts the active term's people | **Fixed as proposed.** `roleHolders(collegeId, termId)` counts a membership held for every term or for that term. The engine, the plan's and the framework's previews, a plan item's person, `assign()` and the assignments page pass their term. `inForce` stays for what a person may do now. assignments.test.ts adds a draft next term: someone who holds a role there for that term alone is counted, assigned and given the template's tasks by the engine, and someone who holds one for the active term alone is neither. With the old filter it fails (`[false, true]` for `[true, false]`). | same commit |
| Minor 1: the property seldom reaches finished work | **Fixed as proposed.** The second version is made from the first: each item kept, reworded, moved or dropped, and a few added; the people stay the same three runs in four. The test counts the runs that call for finished work again with other words or weeks and expects more than one in ten: 33 to 50 of 200 in eight runs, against about one in a thousand before. S20-M1 now fails the property in each of three runs. | same commit |
| Minor 2: no test for the revocation's and the template's passes | **Fixed as proposed.** actions-audit.test.ts gives the department's own template to the imported trainer, then counts the `assignment` passes: one for each of renaming it and adding, correcting and taking out its item, one for the secretary's assignment and one for its revocation. Without the revocation's pass it fails (`expected 6 to be 7`), and without `regenerate()` (`expected 1 to be 5`). | same commit |
| Minor 3: someone who already holds the role for every term | **Fixed as proposed.** `assign()` looks for the role in the department, held for every term or for this one, before it grants it. The page passes `granted` to the board, so the revoke sheet names the role only when this assignment gave it. assignments.test.ts covers both the term's and every term's holder: no new membership, nothing told, and the keys kept. Without the check it fails (`expected true to be false`). | same commit |
| Minor 4: an assignment's pass reads "nightly" | **Fixed as proposed.** `framework.generation.done` has the `assignment` branch, and `queued` and `none` no longer say "من الإطار المنشور". Enhancement 3 guards the next cause. | same commit |
| Minor 5: the preview's numbers and the closed term untested | **Fixed.** The draft-term test expects the publish dialog's exact count, "تُنشئ المسودة مهمة واحدة لمنسوبي القسم في الفصل.": the minutes reach the head once, and the weekly report no one, as SS01 has given the new term no sections. assignments.spec.ts opens a closed term of its own, with Electrical's demo trainer as its safety supervisor: listed, with no Assign and no Revoke. | same commit |
| Minor 6: the multi select without the owner's "why" | **Fixed in #56, beyond the proposal.** The owner's rule of 22 October admits a new animated component only for what none in the code can do, and the shared search field over Motion checkboxes chooses several people. Step 21's assign sheet now does that, and the multi select, its catalog sample and its words are gone, so `/design` is again UX review 2's and #56 needs no visual baselines of its own. The search field's Escape clears a search before a sheet around it closes; the test fails without it. The component map states the rule above its later components, and notes under Steps 22 and 29 say to choose several the same way. | `fix: assign people from a searchable list of checkboxes, without a new animated component (step 21)` on #56 |
| Minor 7: Step 21's words name renameable roles | **Fixed as proposed.** The page's description and its no-term state name the keys' holders: "من يملك صلاحية إسناد تكليفات القسم" and "من يملك صلاحية الفصول التدريبية". The sheet tells a department with no one in the term ("لا أحد يحمل دورًا في القسم في هذا الفصل بعد.") from one whose people all hold the template. | same commit |
| Enhancement 1: a matrix role with every key but the action's | **Applied.** All 66 rows pass. With publishing asking for `plan.edit`, the row fails: "every key but this one across the college: allowed". | same commit |
| Enhancement 2: the review load's busiest week | **Applied.** `busiestWeek()` sits beside `countTasks()` and counts the same way; its unit test covers a tie, the earliest week winning, and no task. The publish dialog adds "أكثرها في الأسبوع W: N مراجعة." when that week asks more than the average, and the demo head's test reads it on Electrical's draft. | same commit |
| Enhancement 3: a guard on a pass's causes | **Applied.** `generationReasons` lists the causes, and the type comes from it. generation-causes.test.ts expects each cause in `audit.causes` and as a branch of `framework.generation.done`; on the old words it fails with `[ 'assignment' ]`. | same commit |

### Re-run results (local, on the final tree)

- `pnpm check:all`: types; lint, 680 files; `pnpm test`, 1009 tests in 125 files; hardcode; boundaries, 576 modules. Clean.
- `pnpm check:unused` (knip): clean.
- `pnpm build`, then every end-to-end spec on the build, desktop and iPhone, without `@visual`: 299 passed and 31 skipped by their projects, in 10.0 minutes. None failed.
- The usability run reads 13.0 modelled minutes for the 50 items, and takes 57 s on the build.
- **CI's first run on #58 was cancelled** at its job's 30-minute limit. To untick the other file types, the usability run went over a list of the ticked boxes, which shrank under its clicks. It waited for a box that was gone until its 20-minute timeout. It now goes over every box once and checks that one is left ticked, and its timeout is 4 minutes, so a run that stalls fails within the job, retry and all.
- The same local run found the publisher test expecting the preview to count a task. Its one item reaches each section's trainer, and the new term has no sections yet, so it now expects "لا تُنشئ المسودة مهام لمنسوبي القسم في الفصل." exactly.

### Hand-off

- **docs/PLAN.md:** notes under Steps 19 (the publisher, the usability run's model), 22 and 24 (role holders by term), and 46 (a head timed building a plan, **You:**).
- **docs/BACKLOG.md:** the two silent choices for the owner below.
- **CHANGELOG.md:** the Audit 7 entry.
- **Owner:**
  - an empty draft is never published, so a department cannot take back all its own items for the rest of a term; and an assignment whose weeks are over is accepted, its tasks overdue at once. Both are in docs/BACKLOG.md for your call;
  - the secretary's role still holds no key (planning observation), so its grant changes what a person may do only once Step 33 gives the role its keys.
