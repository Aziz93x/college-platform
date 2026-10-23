# Audit 6: steps 16-18

- Range, in run order:
  - Step 16 `69f884a feat: Rayat import (step 16)` (PR #42), with `961a71e` (PR #44, ADR-0019, the owner's request that heads import Rayat's reports), read with Step 16.
  - Step 17 `e090bbd feat: courses, sections, enrollments and transfers (step 17)` (PR #45).
  - Lead review C `0715dec lead: section C` (PR #47). It fixed Steps 16 and 17's must-fix items and built proposals 1 to 6 and 9, so Steps 16 and 17 are judged as it left them.
  - The owner's changes that touch the range:
    - `a647d46` (#46): the settings and keys nothing used;
    - `64c721d` (#31): building at the trial's size;
    - `19970be` (#20): the calendar in layers;
    - `b366ed9` (#37): the copied components on the theme's scales.
  - Step 18 `351ba2d Task kinds and section templates (step 18)` (PR #49), squashed from `ed7719c` through `7c46349` with the merge `9c9ed67`. Its tree is `7c46349`'s: `git diff --stat 7c46349 351ba2d` prints nothing.
  - Out of range: `c209713` (#48, ADR-0024), `584319f` (#43), `4808dbe` (#19), `1f0d56a` (#17), `61a4ec4` (#15) and `a823ba9` (#34).
- Audited on `review/audit-18` at `351ba2d`, a clean tree, on 2026-10-22, by the auditor agent with the karpathy-guidelines skill. The first runs were on `step/18-task-kinds` at `7c46349`, which has the same tree.
- **Sources for stated assumptions:**
  - the bodies of PRs #42, #44, #45 and #49, read through GitHub's REST API (read only); #49 has no comments;
  - the commit bodies, CHANGELOG.md and ADR-0019 to ADR-0023;
  - the plan's notes and the code's comments.
- **Left out as known:**
  - lead review C's known limits: the 5 s import budget is a wall-clock test, and a transfer is read against SS01's upload time;
  - docs/BACKLOG.md's items for this range: lead review C's proposals 7 and 8, the worker alternative to the budget, the vice-dean's phone tabs, and the check that trainee numbers are digits;
  - the owner's items: SO01's original headers, the provisional axis titles and the `v0.3-C` tag;
  - as asked, the owner's decisions of 21 and 22 October are not counted as deviations from older plan text.
- Verdict: **no blockers, 3 major, 6 minor.**
  - **What passes.**
    - `pnpm check:all` passes against an empty database with 879 tests. knip is clean, and drizzle-kit finds no schema drift.
    - The range's specs pass on desktop and iPhone: 97 passed, 11 skipped by device, none failed and none flaky.
  - **Test coverage.** Every Done when of the three steps has a test, and each of 14 mutations fails one. Two guards on the new page fail none.
  - **Major 1.** The demo's department templates repeat the college's framework for the same trainers. One of them is identical: a grade analysis per section a week after each exam.
  - **Major 2.** No demo trainer teaches two sections of one course. So "each course's trainer" counts exactly what "each section's trainer" counts in every department (12/12, 10/10, 10/10), and the demo never shows the owner's new reach.
  - **Major 3.** The payload editor, Step 26's form, shows a week and unticked boxes that its payload does not hold. A homework task left at week 1, or an e-learning checklist with one box ticked, fails its kind's schema.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm check:all`, `DATABASE_URL` on the empty `ci_empty` as CI has it, `TESTCONTAINERS_RYUK_DISABLED=true` (on `7c46349`) | exit 0 in 121 s · `Checked 627 files in 573ms. No fixes applied.` · `Test Files  112 passed (112)` · `Tests  879 passed (879)` · `check:hardcode passed.` · `✔ no dependency violations found (541 modules, 2431 dependencies cruised)`. The log shows one `DeprecationWarning` from pg, the known one |
| `pnpm check:unused` · `drizzle-kit generate` on a scratch copy of HEAD (`git archive`) | knip exit 0 · `No schema changes, nothing to migrate` |
| The e2e script (build as CI does, drop and reseed `college`, then Playwright on desktop and iPhone) on `7c46349`: rayat, sections, templates, framework, settings | `✓ Compiled successfully in 2.1s` · `✓ Generating static pages using 3 workers (38/38) in 711ms` · `seed:demo finished with --seed 42 --week 9` · `Running 40 tests using 2 workers` · `4 skipped` · `36 passed (1.2m)` |
| The same script on `351ba2d`: terms, audit, shell, roles (the wizard's copy, the navigation and the roles grid, which Step 18 changed) | `✓ Compiled successfully in 12.4s` · `Running 68 tests using 2 workers` · `7 skipped` · `61 passed (1.6m)`. Every skip comes from its spec's `test.skip` by phone, desktop or touch |
| Docker, read-only SQL on the fresh demo seed | Probes D1 and D2 below |

**Probes.** These ran in the scratch copy (P1 to P3, as throwaway Vitest files beside the tests they imitate) or as SQL on the fresh demo seed (D1, D2).

| Probe | Result |
| --- | --- |
| P1: what a new task's editor shows for an empty payload, rendered as payload.test.tsx renders it, and what `payloadSchema` takes once the trainer types a title or ticks one box. `PayloadEditor` writes only the field that changed (`set(name, next)` on the payload it was given) | `homework {}: shows «<span class="sr-only">الأسبوع 1</span>»` · `e_learning: the editor shows ["checked=false","checked=false","checked=false"] for the payload {}` · `homework {title}: refused ["week: Invalid input: expected number, received undefined"]` · `e_learning {courseShell:true}: refused ["content: Invalid input: expected boolean, received undefined","activities: Invalid input: expected boolean, received undefined"]` (major 3) |
| P2: an advising session's notes field | `<textarea … aria-labelledby="_R_3_-0" aria-label="ما دار في الجلسة" …>`. `aria-labelledby` wins, so the field is named "الجلسة 1". Each session's day picker takes the field's label, "جلسات الإرشاد" (major 3) |
| P3: `describeEvent()` on `sectionTemplate.create` and `.delete`, with describe.test.ts's lookups | `subject «0199b2a4-0000-7000-8000-0000000000f1»` · `axisId=0199b2a4-… \| النوع=exam_copy \| appliesTo={"type":"eachCourse"} \| due={"type":"week","week":7} \| evidence={"required":true,"types":["pdf"],"maxFiles":2,"requiresApproval":true} \| notes=` (minor 2) |
| D1: each demo template, beside the published framework's items of its kind | 9 of the 10 templates repeat a college item of their kind for the same trainers; only Electrical's quizzes do not. "تحليل نتائج الشعبة" and the framework's "تحليل نتائج الاختبار" are both `eachSection`, `{"type": "afterEvent", "weeks": 1, "eventKind": "exam"}`, in Electrical and in Mechanical. The midterm and final copies (weeks 7 and 16, `eachCourse`) repeat "نسخة الاختبار ونموذج الإجابة" (`eachCourse`, in each exam's week). E-learning, homework and practices repeat the framework's items for the trainer's role (major 1) |
| D2: SS01 in force, per department: sections · section-trainer pairs · course-trainer pairs | `التقنية الكهربائية 12 · 12 · 12` · `التقنية الميكانيكية 10 · 10 · 10` (one section co-taught, one untaught) · `الدراسات العامة 10 · 10 · 10`. Every course has two sections taught by two different trainers, for example `كهر 111: 200015, 200016` (major 2) |

**Mutation checks.** I applied each change to the scratch copy of HEAD, ran the named tests there, then restored the file and checked it against HEAD (`restored (same as HEAD)` each time). Before any mutation, the copy's baseline gave `Test Files  15 passed (15)` and `Tests  189 passed (189)`.

| Mutation | Result |
| --- | --- |
| M1: `payloadSchema()` takes unknown keys (`z.object` for `z.strictObject`, payloads.ts:154) | payloads.test.ts: 11 fail, "refuses a … missing a field or with one of its own" for every kind |
| M2: a grade analysis with no trainee in any band passes (payloads.ts:137) | payloads.test.ts: "refuses what each field of a grade_analysis cannot hold" fails |
| M3: `openNextTermAction` without `copyTemplatesInto` (`src/app/(app)/terms/actions.ts:100`) | actions-audit.test.ts: 2 fail, "each change to the college's records writes its own event…" first |
| M4: a closed term's templates change (`changing()`, templates.ts:179) | templates.test.ts: "changes no template once its term has closed" fails |
| M5: `addTemplate()` without `offersItem()` (templates.ts:131) | templates.test.ts: "takes only file types the college accepts and a kind of calendar day it has" fails |
| M6: `addTemplateAction` asks for `plan.edit` across the college (`src/app/(app)/templates/actions.ts:51`) | permission-matrix.test.ts: "addTemplateAction runs for exactly the roles that hold plan.edit across the college, or where its person is" fails |
| M7: `trainerCounts()` counts a course's trainer once per section (counts.ts:25) | counts.test.ts fails. sections.test.ts passes: its fixture has no trainer with two sections of one course, as the demo has none (major 2) |
| M8: an item for each course's trainer counts the section trainers (count.ts:68) | count.test.ts: "counts nothing for no items, … each trainer of each course once for all its sections" fails |
| M9: a section template may reach a role (inputs.ts:103-105) | inputs.test.ts: "lets a section template reach each section's or each course's trainers, never a role, and asks which" fails |
| S16-M1: the upload's audit event keeps three raw rows of the file (imports.ts:348) | rayat.test.ts: "are in no column of the Rayat tables and in no row of the database" fails |
| S16-M2: a rollback leaves its version in force (imports.ts:462) | rayat.test.ts: 2 fail, "is applied in one step, kept with the versions before it, and rolled back to the one before" first |
| S16-M3: no check that capacity is enrolled plus remaining (check.ts:270) | check.test.ts: "reads numbers in either set of digits and checks that a section's capacity is its enrolled plus its remaining" fails |
| S17-M1: a transfer moves completed work too (transfers.ts:109) | transfers.test.ts: "leaves their completed work with them, marked until the week before the transfer" fails |
| S17-M2: the unmatched report lists trainers on the platform (sections.ts:356) | sections.test.ts: "report the trainers SS01 names who are not on the platform…" fails |
| Not run, found by search: `/templates` without its refusal (page.tsx:43), or editable on a closed term (page.tsx:171) | No spec opens `/templates` without `plan.edit` or on a closed term (`grep -rn "/templates" e2e/` finds only templates.spec.ts:28 and :92) (minor 3) |

## Done when

| Step | Item | Status | Evidence |
| --- | --- | --- | --- |
| 16 | Synthetic SS01, SF01 and SO01 files in XLSX, built on section 9's headers, import end to end, and the demo seed loads them | proven | rayat.spec.ts:91 on desktop and iPhone builds the files with write-excel-file and imports them through the page. seed-demo.test.ts checks the demo's imports |
| 16 | A test asserts that no name, mobile or grade column exists in the schema or the data | proven | rayat.test.ts:414 checks every Rayat column and every row of every table. S16-M1 fails it |
| 16 | Rollback restores the previous version | proven | rayat.test.ts:155, and the end-to-end test rolls back a newer SS01. S16-M2 fails it |
| 17 | Unit tests prove the transfer rules (completed work stays, open work moves) | proven | transfers.test.ts:113-151 (`transferTasks()`). S17-M1 fails it |
| 17 | The unmatched report lists trainers missing from people | proven | sections.test.ts:283, the demo's visitor 209001 in seed-demo.test.ts and on the SS01 card in rayat.spec.ts. S17-M2 fails it |
| 18 | Payload validation is tested for every kind | proven for the schema | payloads.test.ts:50, `:54` and `:95` run every kind: a filled payload passes, one missing a field or carrying an extra field is refused, and so is each value a field cannot hold. M1 and M2 fail them. What the editor produces is never checked against the schema (major 3) |
| 18 | A head creates section templates on the screen | proven, through a double role | templates.spec.ts:48 adds, corrects and removes a template on desktop and iPhone. Its account is also the vice-dean, and the term is a draft of the test's own (`:69-82`), because a draft term shows only to `term.manage`. No test adds one as a head alone on the active term (minor 3) |
| 18 | Every template points to an axis | proven | `axis_id` is `NOT NULL` with a composite foreign key to the college's axes (migration 0020, lines 11 and 24). templates.test.ts:151 tries both, and the sheet always starts on an axis |
| 18 | The Step 13 wizard copies templates as drafts | proven | templates.test.ts:262 (in order, on each department's history). actions-audit.test.ts runs the action and expects `sectionTemplate.copy`, which M3 removes. Templates have no status: all of them are drafts until Step 19 publishes the plan (stated) |

**Plan rules.**

- **Hardcoded values.**
  - `check:hardcode` passes.
  - The Arabic that Step 18 added under `src/` is in tests only.
  - No role key appears in `src/` outside tests.
  - The numbers in code are guards: `payloadLimits` (200, 2000, 100, 20, 10, 50, 10,000) work like `frameworkLimits`.
  - A band's bound is a whole percent from 0 to 99, and the top band reads to 100. That is the percent scale, not a college value.
  - The three e-learning checks are section 3's capability.
- **Permissions by key.**
  - `plan.edit` comes back under planning, with no two-factor, as section 0 schedules it for Step 18.
  - Each action checks it in the template's department, and the navigation item uses it.
  - The base seed gives it to the head. Migration 0020 gives it to colleges seeded while it was out, by role key as 0009 and 0016 did: seed data, not a check.
  - The leftover is `framework.publish` on the settings item (minor 1).
- **Server actions.**
  - Step 18 adds three: `addTemplateAction`, `updateTemplateAction` and `removeTemplateAction`. Each runs through `viewerAction`, with Zod (`sectionTemplateInput` plus `termId` and `departmentId`, or `templateId`) and the key in the template's department.
  - Each has its row in the permission matrix (`inDepartment`) and its line in actions-audit.test.ts.
  - `openNextTermAction` now also writes `sectionTemplate.copy`.
  - Steps 16 and 17's seven actions keep their rows, as lead review C checked.
- **Audit events.**
  - `sectionTemplate.create` and `.update` record the template's term, department and fields before and after. `.delete` records its title, and `.copy` is recorded on each department.
  - A save that changes nothing writes no event (`canonical()`).
  - The log's words for these events: minor 2.
- **Screen states of `/templates`.**
  - Loading: `templates/loading.tsx`, shaped like the page, with no text.
  - Empty: no term; no department the viewer prepares; the department's own list empty (end-to-end test at `:97`); no framework item for trainers.
  - Partial: the framework not yet published while the department's templates exist (end-to-end test at `:95`); a closed term's templates, read only.
  - Error: the `(app)` error boundary, and each refusal of an action in an alert.
  - No permission: `forbidden()` without `plan.edit` anywhere, and the shell offers no item.
  - Right to left, axe and 44 px targets are checked in both tests on both devices.
  - Untested: the refusal, the closed term and no department (minor 3).
- **Demo data** (the fresh seed).
  - 10 templates, each added by its department's head, with its device, in the log: Electrical 7, Mechanical 3, General Studies none.
  - The framework's version 1 gives its exam copy to each course's trainer and its grade analysis to each section's trainer. Version 2 waits as a draft.
  - The templates repeat the framework (major 1), and no course shows its reach (major 2).
- **Isolated network and components.**
  - Nothing new is fetched or shipped.
  - No new animated component: the sheet, stepper, select, date picker, checkbox and action swap all come from `src/components/motion/` (section 0).
  - templates.spec.ts joins the stack's smoke. Its writing test keeps `@database`, and `stack-specs.test.ts` passes.
- **Migration 0020** states its inverse. Its index `(term_id, department_id, position)` serves both the list and the copy.

## Karpathy guidelines

1. **Think before coding: stated, with three silent choices in Step 18.**
   - **Step 16** (#42) lists six assumptions. One is the departure from "stream large files": a file is read whole, recorded in the note under Step 16. The owner's request has its ADR-0019.
   - **Step 17** (#45) lists five:
     - sections are read from Rayat's version in force, not copied;
     - trainers are matched by employee number when a page is read;
     - a new key, `sections.transfer`;
     - a transfer's state is worked out, not stored;
     - the task rules are a domain function for Step 20.
   - **Step 18** (#49) asked the owner. The answers are recorded under Steps 18, 20 and 31, with notes under Steps 19, 26, 30 and 34.
     - Its stated assumptions: the college's templates are the framework's items for trainers; templates stay drafts until Step 19; payloads are lists of fields; indicator mappings wait for Step 34.
     - It names two decisions and leaves them to their steps: whether a head sees a draft term (Step 19), and what a transfer does to a course's task (Step 20).
   - Three choices are silent:
     - whether a department template may repeat a college item for the same trainers (the demo does: major 1);
     - what the editor starts a new payload with (major 3);
     - a demo SS01 in which no course shows the new reach (major 2).
2. **Simplicity: proportionate.**
   - **Step 18** adds about 2,400 lines of code and removes 490.
     - About 420 of the removed lines moved into `src/app/(app)/_items` for a second user.
     - One field list per kind yields its schema, editor and view: 11 kinds on 7 field types, not 33 hand-written parts.
     - Each extraction has two users: `ItemSheet`, `itemVocabulary`, `DepartmentSelect` and `offersItem()`.
     - The editor and the view have no screen until Step 26, but the step's Do asks for them.
     - Some helpers are copied again: `canonical()` a third time, `changeBy()` a sixth and `drawn()` a fourth (minor 5).
   - **Steps 16 and 17.** I agree with lead review C:
     - Rayat's checks are as long as the plan's list of them needs;
     - no tables for courses, sections and enrollments, which are read from SS01 and SF01;
     - one table for transfers;
     - a 113-line transfer domain.
3. **Surgical changes: good.**
   - Step 18's catalogs came and went inside the pull request:
     - `ed7719c` added four catalog settings, a settings tab and two variants of the list control;
     - `d679a7d` removed them after the owner's answers.

     The final diff leaves the settings screen and `src/components/list-field.tsx` as `main` had them, except one line (minor 1). Some words still say "each section" only (minor 4).
   - Every other changed file traces to the step:
     - the shared sheet;
     - the department chooser, now used by `/sections` too;
     - `plan.edit` in the access tests;
     - the page counts in audit.spec.ts;
     - the seed-base test, now an `it.each` over migrations 0009 and 0020.
   - Steps 16 and 17 shared code only where it gained a second user: `FileField` serves the people import and the Rayat upload, and `rayatVersion()` serves the framework's preview and the sections.
4. **Goal-driven execution: strong in the services and the schema, weak where the editor meets the schema.**
   - Each of 14 mutations across the three steps fails a test.
   - The editor's tests render its labels but never check its output against the schema (major 3).
   - The page's refusal and its closed-term guard fail no test (minor 3).

## Findings

### Blocker

None.

### Major

**1. The demo's department templates repeat the college's framework for the same trainers, one of them exactly. The new page shows each pair, and once Steps 19 and 20 run, each trainer gets the same work twice.**

- **Where.**
  - db/seed/demo/templates.ts:29-93 (`ELECTRICAL`) and `:96` (`MECHANICAL`: Electrical's first, second and fifth).
  - db/seed/demo/framework.ts: the framework's items at `:46` (the exam copy, `eachCourse`, in each exam's week), `:60` (the grade analysis, `eachSection`, a week after each exam), `:88` (homework samples), `:102` (practices) and `:116` (e-learning), the last three for the trainer's role.
- **Probe D1.**
  - 9 of the 10 templates repeat a college item of their kind for the same trainers. Only Electrical's quizzes (`:50`) do not.
  - "تحليل نتائج الشعبة" (templates.ts:68) has exactly the reach and due rule of the framework's "تحليل نتائج الاختبار", in both departments.
  - The midterm and final copies (`:32` and `:41`) are the framework's exam copy for the same two exams, asked a week earlier.
  - E-learning, three homework samples and practices (`:59`, `:77`, `:86`) repeat the framework's items for every trainer.
- **What follows.**
  - On `/templates`, the head of Electrical reads the grade analysis in "من الإطار العام" and again in "قوالب القسم". The page separates the college's items from the department's own, and the demo blurs exactly that line.
  - When Step 19 publishes the plan and Step 20 generates it, every Electrical and Mechanical trainer gets a second grade analysis per section and exam, and the exam copies twice.
  - UX review 2 and the GA demonstration review this data as it stands.
  - templates.spec.ts:36-43 and seed-demo.test.ts:708 lock the duplicates in.
- **Why it was easy to miss.** The page's college card lists only items for each section's or each course's trainer (`src/app/(app)/templates/page.tsx:112-114`). The framework's items for the trainer's role, such as homework, e-learning and practices, never appear where a head adds templates.

Fix:
- Give the departments work the framework does not ask of the same trainers. Keep the quizzes (`:50`). Add, for example:
  - the practical exam's copy, once per course;
  - a workshop safety checklist, once per course, in week 1;
  - a lab report sample, once per section.
- Keep one template per course and one per section in each department.
- Update templates.spec.ts:36-43 and the lists in seed-demo.test.ts:708.
- seed-demo.test.ts:708's lists then name the department's own work. Enhancement 3 would warn a head who repeats a college item.

Cost: 30 min.

**2. No demo trainer teaches two sections of one course. So "each course's trainer" counts what "each section's trainer" counts in every department, and the demo never shows the owner's new reach.**

- **Where.**
  - db/seed/demo/rayat.ts:145-148 gives each course's two sections the trainers `(position * 2 + section) % trainers`: two different people.
  - Probe D2: Electrical has 12 sections, 12 section-trainer pairs and 12 course-trainer pairs; Mechanical has 10 of each, and General Studies 10.
- **What follows.**
  - The framework's preview gives the same number for the exam copy whether it reaches each course's trainer or each section's.
  - The note under Step 20 that Step 18 wrote (docs/PLAN.md:1108) expects the demo to check "the preview on both", but the totals cannot tell them apart. Step 20's Done when ("for every demo framework and plan, the published preview equals the tasks generated") would pass with an engine that makes course work per section.
  - M7 shows the same blind spot in sections.test.ts, whose fixture has no such trainer either.
  - No one reviewing the demo sees "once for all their sections of it", the owner's answer of 22 October. In TVTC's colleges, a trainer usually teaches several sections of one course.

Fix:
- In the demo SS01, let one trainer teach both sections of one course in Electrical and in Mechanical. Keep it away from the transferred section 30112 and the visitor's 30111, and keep the co-taught and untaught sections.
- In seed-demo.test.ts, expect `sectionCounts()` to give those departments fewer course trainers than section trainers.
- Then check that the framework preview's words for the exam copy differ from a per-section count.

Cost: 30 min, with the counts the Rayat and sections tests read.

**3. The payload editor shows a week and unticked boxes that its payload does not hold. A homework task left at week 1, or an e-learning checklist with one box ticked, fails its kind's schema.**

- **Where.**
  - `src/app/(app)/_kinds/payload-editor.tsx:159` shows `Number(value ?? 1)` for a week field, and `:181` shows `Boolean(value)` for a check field. Neither writes that value to the payload until it is changed.
  - `payloadSchema()` requires both (src/modules/framework/domain/payloads.ts:117 and `:121`).
  - The tests render the editor with `value={{}}` (payload.test.tsx:77) and look only for labels.
- **Probe P1.**
  - An empty homework payload shows "الأسبوع 1". Typed with a title only, it is refused: `week: … received undefined`.
  - An e-learning task with only its first box ticked is refused for `content` and `activities`.
  - A trainer would have to change the week twice, or tick and untick each box, to save.
- **Also (P2).**
  - Each advising session's notes field is named "الجلسة n": its `aria-labelledby` (`:454`) overrides its `aria-label`, "ما دار في الجلسة" (`:455`).
  - Every session's day picker is named "جلسات الإرشاد".
  - The trainees field allows five digits (`:355`) where the schema stops at 10,000.
- **Why now.** Step 26 mounts this editor as it stands, by the note under Step 26 that this step wrote. That note says nothing about a starting payload, and no screen shows the editor before then, so neither axe nor any person sees it until the trainer's card.

Fix:
- Next to `kindFields`, add `blankPayload(fields, week)`, with each field's starting value:
  - `false` for a check;
  - the term's current week for a week field;
  - `""` for a text;
  - `[]` for a list.

  The card starts from it, so what the editor shows is what the payload holds.
- Add a unit test for every kind: the blank payload, with its required texts and lists filled, passes `payloadSchema()`.
- Name each session's notes and day by its session: drop `aria-labelledby` on the notes field, and give the picker "الجلسة n".
- Cap the trainees field at `payloadLimits.count`.

Cost: 30 min.

### Minor

**1. The settings item still opens for `framework.publish`, the key of the catalogs that left.**
- **Where.**
  - `src/app/(app)/_shell/navigation.ts:83-85`: `permission: ["settings.manage", "term.manage", "framework.publish"]`, with the comment "count a term's weeks and keep the catalogs there".
  - `ed7719c` added the key for the catalogs. `d679a7d` took the catalogs out and left the key.
- **The effect.** No setting is edited with `framework.publish`. Anyone the admin gives it to, without `term.manage`, sees "الإعدادات" in the shell and gets the refusal (`src/app/(app)/settings/page.tsx:50`). The vice-dean's defaults hide this, as that role holds both keys.
- **Why no test fails.** navigation.test.ts:110-123 checks that every key that edits a shown setting opens the item. It does not check the reverse.

Fix: restore `["settings.manage", "term.manage"]` and the comment as `main` had them. In navigation.test.ts, also expect that each key of the settings item edits some setting with a control. Cost: 10 min.

**2. The audit log names a section template by its id, and shows its fields as raw keys and JSON.**
- **Where.** `subject()` (`src/app/(app)/audit/describe.ts:146-224`) has no case for `sectionTemplate`, so it falls to `default: return id` at `:222`. Each earlier step added its entity's case with a test: the axis (Step 14), the framework (15), the Rayat import (16) and the section's transfer (17).
- **Probe P3.**
  - The subject of `sectionTemplate.create` and `.delete` is the template's UUID.
  - The changes show `axisId` as a UUID and the kind as `exam_copy`.
  - `appliesTo`, `due` and `evidence` show as JSON, with English field names. The framework's item events (Step 15) render those three fields the same way.

Fix:
- Add a `sectionTemplate` case: the title and the term, from `diff.to` or `diff.from`, with a describe test like the section transfer's (describe.test.ts:323).
- Give `format()` words for the item's fields, shared with the framework's items: the axis's title, the kind's word and the reach. The due rule and the evidence policy take the words `itemVocabulary()` already builds.

Cost: 15 min for the subject, 30 min with the fields.

**3. `/templates`' refusal, closed-term and no-department states have no test, and the head who creates templates on the screen is also the vice-dean.**
- **Where.**
  - No spec opens `/templates` without `plan.edit` or on a closed term. Removing `forbidden()` (page.tsx:43) would show a trainer the "no department" empty state instead of the refusal, and making every term editable (`:171`) would offer controls the service then refuses. Neither would fail a test.
  - rayat.spec.ts:309 and sections.spec.ts:220 each have their "without the key" test.
  - templates.spec.ts:48 gives its account the vice-dean's role too (`:79-82`), because its term is a draft (`:61`), which only `term.manage` sees.

Fix:
- Add "without the key: a trainer is refused `/templates`, and the shell offers none", as sections.spec.ts:220 does.
- Add a closed term of the test's own whose list is read only.
- Optionally, let the writing test sign in as a head alone on the active term, under a unique title, so each device keeps to its own template.

Cost: 20 min.

**4. Some words still say that a template reaches each section's trainer only.**
- **User-facing.** messages/ar.json:2137, the sheet's description: "يصل القالب إلى مدرب كل شعبة من شعب القسم." The sheet asks for the reach right below it.
- **Comments.**
  - `src/app/(app)/templates/templates-editor.tsx:24-26`, "without whom they reach";
  - `src/app/(app)/templates/page.tsx:34-36`;
  - tests/integration/templates.test.ts:27-28;
  - the header of migration 0020 (lines 1-2). Leave that one: it is merged, and its comment is harmless.
- **The plan.** docs/PLAN.md:1106 still says the demo has "the exam copy for each section's trainer". Step 18 moved that item to each course's trainer (`:1108`).

Fix: reword them. The sheet can say "يصل القالب إلى مدرب كل شعبة، أو إلى مدرب كل مقرر مرة واحدة للمقرر كله." At `:1106`, write "the grade analysis for each section's trainer". Cost: 10 min.

**5. `canonical()` is copied a third time, and the actions' glue again.**
- **Where.**
  - src/modules/planning/server/templates.ts:31-39 is the framework's `canonical()` (src/modules/framework/server/framework.ts:30-38) line for line. Rayat's diff has a third (src/modules/rayat/domain/diff.ts:22-30).
  - `src/app/(app)/templates/actions.ts:23-39` adds a sixth `changeBy()` and a fourth `drawn()`.
- **Status.** Lead review C counted two `canonical()` copies. Lead review B's proposal 4 waits in docs/BACKLOG.md:72, counting `changeBy()` in three files.

Fix: put one `canonical()` in `src/platform/validation/` and use it in the three places. Update the backlog item's count of `changeBy()` and `drawn()`. Cost: 15 min.

**6. Step 18's squash title has no Conventional Commits type.**
- **Where.** `351ba2d Task kinds and section templates (step 18) (#49)`. The other 19 step commits have their type, for example `feat: courses, sections, enrollments and transfers (step 17) (#45)`.
- **The rule.** "Commit titles follow Conventional Commits", with `feat: sign-in (step 06)` as the example (docs/PLAN.md:36, `:38`).
- **Why.** The PR's title, which became the squash title, had no type. `git log --grep "(step "` still finds it.

Fix: no rewrite of `main`. Say in `.claude/commands/step.md`'s step 5 that the PR's title is a Conventional Commit ending in `(step NN)`. Cost: 2 min.

## Enhancements (at most 3)

1. **The kinds' editors in the design catalog.**
   - `/design` (`design.view`) shows each kind's `PayloadEditor` with its `PayloadView` beside it, so what the view shows is what the payload holds.
   - An end-to-end test fills each kind on desktop and iPhone, with axe and the 44 px check.
   - Benefit: the editor is tested end to end, axe-checked and touch-checked before Step 26 mounts it, and UX review 2 sees it. It would have caught major 3 and P2.
   - Cost: about 1 h.
2. **A guard: every audit entity has a subject.**
   - A unit test runs `describeEvent()` on a typical event of each of `auditEntities` and fails when the subject is the entity's id.
   - Benefit: Step 19's plans and Step 21's assignments get their words in their own pull requests, as `stack-specs.test.ts` does for the smoke's list. It would have caught minor 2.
   - Cost: 20 min.
3. **Show a head the college's work for their trainers, and warn before repeating it.**
   - `/templates` lists every published framework item that the department's trainers receive, including those for the trainer's role.
   - The sheet warns when a template has the kind and reach of one of them: "يطلب الإطار العام هذا من المدربين: «…»".
   - Benefit: Step 20 does not generate the same work twice, and major 1 cannot recur from the screen.
   - Cost: 45 min, with a note under Step 19, whose plan shows inherited items locked.

## Planning observations (not defects of Steps 16-18)

- **The owner's notes of 21 October are not built yet.** They set exam periods by week number with a catalog of their types, the due rule anchored to each period of a type, and the calendar in layers. They changed what Steps 13 and 15 built, and no step implements them yet. Their effects in this range:
  - Step 18's "one week after the midterm exam week" cannot be expressed. An after-an-event rule counts each calendar event of a kind ("exam"), so the demo's midterm and final copies sit at fixed weeks 7 and 16 (db/seed/demo/templates.ts:35 and `:44`).
  - Step 19's department deadlines, anchored to exam-period types, depend on the anchored rule, and so does Step 24's calendar layer for the department.
  - Suggestion: give the catalog, the periods by week and the anchored rule a change pull request before Step 19, or make them its first part. Move the demo's exam copies and analyses onto the anchored rule then.
- **An exam's type, typed or carried.** Once periods have types, decide at Step 20 or 26 whether a task generated from a period carries the period's type into the payload's `examType`. Otherwise the trainer types it, as the owner's answers of 22 October have it.
- **The vice-dean cannot read a department's templates.** Section 1 lets the vice-dean read every department, but nothing shows a department's templates to the vice-dean or the dean yet. Step 19's plan view can decide, as ADR-0021 did for `/sections`.
- **Already recorded for later steps:** whether a head sees the next term's templates while the term is a draft (Step 19), and what a transfer does to a course's task (Step 20).
- **For the owner: ADRs and dated notes.** The definition of done asks for an ADR for any decision that changes the plan. The notes of 21 and 22 October live in docs/PLAN.md only. The owner may say whether such dated notes stand in for an ADR.

## How this audit left the environment

- **Database `college`.**
  - The e2e script dropped and reseeded it before each of the two runs, as the instructions ask.
  - It holds the second run's demo seed and whatever the terms, audit, shell and roles specs left: 1 term, 10 section templates, 20 framework items (version 1 published, version 2 a draft), 5 Rayat imports, 47 people and 598 audit events.
  - A last reseed to plain demo data was refused by the session's permission check, so I left the database as it is.
- **Database `ci_empty`.** It was recreated empty for `check:all` and is still there, empty.
- **Docker.**
  - It had stopped while the session paused. `docker-up.sh` started it again.
  - Only `college-dev-postgres-1` runs, and Testcontainers left no container behind.
- **Servers.** None is running, and port 3000 is free.
- **Files.**
  - `pnpm build` rewrote `.next/` twice, and the static files and `public` were copied into `.next/standalone`.
  - `check:types` rewrote `.next/types` and `tsconfig.tsbuildinfo`.
  - The e2e runs rewrote `test-results/`, `.local/e2e/admin.json` and `.local/e2e/trainer.json`. The JSON files hold sessions of the current `college`.
  - The script writes its build log to the scratchpad's `a15-build.log`. Copies of both build logs are in this audit's folder.
- **Scratchpad.** Everything this audit made is in `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/a18/`:
  - the logs (`checkall.log`, `knip.log`, `e2e.log`, `e2e2.log`, `build.log`, `build2.log`);
  - the scratch copy of HEAD with the three probe tests (`copy/`);
  - the mutation runner and one log per mutation (`tools/`).
- **Repository.** Nothing changed except this report, which is not committed.

## Resolution (review/audit-18)

- Branch `review/audit-18` from `main` at `351ba2d`, 2026-10-22: the tree the audit judged. The `/audit` command asks for three things: fix every blocker and major, apply the enhancements that stay in the plan and take under an hour, and backlog the larger ones. Each minor finding gets a disposition here.
- Commits are named by title. The squash-merge to `main` is titled `audit: steps 16-18`.
- `seed:demo` changes. A fresh seed now has:
  - 6 section templates in place of 10, Electrical's 4 and Mechanical's 2, none of them an item the term's published framework gives the same trainers;
  - in each department, one trainer who teaches both sections of the third course. The SS01 in force then gives 12 sections, 12 section trainers and 11 course trainers in Electrical, and 10, 10 and 9 in Mechanical and in General Studies.

  The random stream is unchanged: a section's trainer comes from its place in the department's list, not from a draw.

| Finding | Disposition | Commit |
| --- | --- | --- |
| Major 1: the department templates repeat the framework | **Fixed as proposed.** Electrical asks for two things once per course: the practical exam's copy (week 15, with the head's approval) and the quizzes (every 4 weeks). It asks for two once per section: the workshop's safety checklist (week 1, a `general` task) and samples of the lab reports (week 12, `homework`). Mechanical asks for the practical exam's copy and the safety checklist. seed-demo.test.ts lists them, and checks that none has the kind, reach and due rule of an item of the term's published framework: on the old seed it fails on "تحليل نتائج الشعبة". templates.spec.ts expects 4 templates, the practical exam's copy first, for each course's trainer. The department's empty list now asks a head for "what the department asks of its trainers that the framework does not". | `fix(seed): the demo's own department templates and a course with one trainer (audit 6, majors 1 and 2)` |
| Major 2: no trainer with two sections of a course | **Fixed, in every department.** The demo SS01 gives the third course's second section the first one's trainer. That keeps clear of the visitor's 30111, the transferred 30112 and 30113, and the third department's co-taught and untaught sections. A new test in seed-demo.test.ts expects `sectionCounts()` to give each department fewer course trainers than section trainers, and the old seed fails it. The note from Step 18 under Step 20 says so. Lead review C's note there now names the grade analysis as the item for each section's trainer (minor 4). | same commit |
| Major 3: the editor shows what the payload does not hold | **Fixed as proposed.** `blankPayload(fields, week)` sits beside `kindFields`, exported by the framework module. It unticks each box, puts a week field at the week given, and leaves each text `""` and each list `[]`. A day or a percentage stays out, as its field starts empty. The note under Step 26 says the card starts a task's payload from it with the term's current week. payloads.test.ts checks every kind: the blank payload, with what has no answer to start with filled in, passes `payloadSchema()`. With a week or a box left out of the blank, homework and e-learning fail it. Each advising session's day and notes are named "يوم الجلسة n" and "ما دار في الجلسة n", and the notes field has no `aria-labelledby`. Each grade band's two fields carry its number too, as they were the same for every band. The render test fails on the old editor. A band's trainees stop at 9,999, the most the field's four digits write; a test checks that the schema takes the most the field can write, and with 10,000 it fails. | `fix(kinds): a blank payload holds what the editor shows; entries named by number (audit 6, major 3)` |
| Minor 1: `framework.publish` on the settings item | **Fixed as proposed.** The item opens for `settings.manage` and `term.manage`, with `main`'s comment. navigation.test.ts adds the reverse check, that every key of the item edits a setting with a control; it fails with the extra key. | `fix(audit): the settings item's keys, and a section template named in the log (audit 6, minors 1 and 2)` |
| Minor 2: a template named by its id in the log | **The subject fixed; the fields' words in docs/BACKLOG.md.** `subject()` names a section template "title · department · term" from `diff.to` or `diff.from`, with a test for one added and one taken out. The framework's items have lacked the words for an item's axis, kind, reach, due rule and evidence since Step 15. They wait for UX review 2, which reviews the audit log. | same commit |
| Minor 3: `/templates`' refusal and closed term untested | **Fixed.** templates.spec.ts adds two tests. A trainer is refused the templates page, and the shell offers none. A head alone reads a closed term of the test's own, with its template and no button. With `forbidden()` and the closed term's guard taken out of the page, both fail on the desktop and the iPhone (4 failed). The writing test keeps its draft term and the vice-dean's role, so each device keeps to its own list. | `fix(templates): refusal and closed-term tests, the reach in words, one canonical() (audit 6, minors 3 to 6)` |
| Minor 4: "each section" only | **Fixed.** The sheet's description reads "يصل القالب إلى مدرب كل شعبة، أو إلى مدرب كل مقرر مرة واحدة للمقرر كله.". The comments in templates-editor.tsx, page.tsx and templates.test.ts name both reaches. Migration 0020's header stays, as the audit advised. | same commit; the plan's line with majors 1 and 2 |
| Minor 5: `canonical()` three times | **Fixed as proposed.** One `canonical()` lives in `src/platform/validation/text.ts`, which a module's domain may import, with a unit test. The framework, the templates and Rayat's diff use it. Lead review B's proposal 4 in the backlog now counts `changeBy()` in eight action files and `drawn()` in four. | same commit |
| Minor 6: Step 18's squash title | **Recorded.** Step 5 of `.claude/commands/step.md` says the PR's title, which the squash keeps, is a Conventional Commit ending with (step NN). `main` is not rewritten. | same commit |
| Enhancement 1: the kinds' editors in the design catalog | **docs/BACKLOG.md**, for UX review 2 or Step 26. It takes about 1 h, and major 3's tests now cover what it would have caught first. | same commit |
| Enhancement 2: a guard that every entity has a subject | **Applied.** describe.test.ts gives each of the log's entities a typical event. Because the list `satisfies Record<AuditEntity, …>`, a new entity needs one. The test fails when an event's subject is its id; without the template's case it fails for `sectionTemplate`. The audit module exports the `AuditEntity` type. | `fix(audit): …` |
| Enhancement 3: show the framework's work and warn before repeating it | **docs/BACKLOG.md, for the owner.** It changes the head's flow, so it waits for the owner's acceptance, then an ADR and a note under Step 19. | `fix(templates): …` |

### Re-run results (local, on the final tree)

| Command | Result |
| --- | --- |
| `pnpm check:all`, `DATABASE_URL` on the empty `ci_empty` as CI has it, `TESTCONTAINERS_RYUK_DISABLED=true` | exit 0 · `Checked 628 files in 594ms. No fixes applied.` · `Test Files  113 passed (113)` · `Tests  912 passed (912)` · `check:hardcode passed.` · `✔ no dependency violations found (542 modules, 2436 dependencies cruised)` |
| `pnpm check:unused` | knip exit 0 |
| The e2e script (build as CI does, drop and reseed `college`, then Playwright on desktop and iPhone): templates, sections, rayat, framework, settings, audit, shell | `✓ Compiled successfully in 25.1s` · `seed:demo finished with --seed 42 --week 9` · `Running 92 tests using 2 workers` · `82 passed (1.9m)` · `10 skipped`, each by its spec's device |
| Read-only SQL on that seed | the counts and the 6 templates above |

**Mutation checks.** I applied each change, ran the named tests, then restored the file and checked it against the branch.

| Mutation | Result |
| --- | --- |
| `blankPayload()` without a week's and a box's starting values | payloads.test.ts: 3 failed, "unticks each box, …" and the blank homework and e-learning |
| `payloadLimits.count` back at 10,000 | payloads.test.ts: "takes the most trainees a band's field can write" fails |
| The editor as `main` has it | payload.test.tsx: "names each band's fields and each session's day and notes by their number" fails |
| The settings item with `framework.publish` | navigation.test.ts: "opens the settings page for no key that edits no setting it shows" fails |
| `subject()` without the template's case | describe.test.ts: 2 failed, the template's test and the guard's `sectionTemplate` row |
| The demo's `rayat.ts` and `templates.ts` as `main` has them | seed-demo.test.ts: `2 failed \| 15 passed (17)`, the course trainers and the templates |
| `/templates` without `forbidden()`, and editable on a closed term | templates.spec.ts on a fresh build: 4 failed, both new tests on both devices |

### Known limits

- The refusal test joins the production stack's smoke in CI only: this container has no images of this build. The closed term's test is `@database`, as the writing test is.
- `blankPayload()` has no caller before Step 26's card; its tests and the note under Step 26 tie it to the editor.
- The seed's repeat check compares a template's kind, reach and due rule with the framework's items. A template that asks for a college item again under another due rule passes it, as the old midterm copy would have. Enhancement 3 is the guard on the screen.

### Hand-off

- **docs/PLAN.md:** the note from Step 18 under Step 26, on the blank payload; under Step 20, the demo's trainer of both sections of a course, and lead review C's note on the grade analysis.
- **docs/BACKLOG.md:** enhancements 1 and 3, the log's words for an item's fields, and lead review B's proposal 4 recounted.
- **CHANGELOG.md:** the Audit 6 entry.
- **Owner:** enhancement 3, a flow proposal to accept or decline. The planning observations above are also in the PR:
  - give the 21 October exam periods and anchored rule a change PR before Step 19;
  - decide whether an exam's type comes from its period;
  - decide on a view of the templates for the vice-dean and the dean;
  - say whether dated notes in the plan stand in for ADRs.
