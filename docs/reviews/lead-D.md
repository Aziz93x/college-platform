# Lead review D: department planning, the head's part (Steps 18 to 22)

- Section D in run order, from `git log --oneline 0715dec..HEAD --first-parent` on `review/lead-D` (`0715dec` is lead review C's merge, the `v0.3-C` tag):
  - Step 18, task kinds and section templates: `351ba2d` (#49); Audit 6: `f07ea7e` (#52, docs/reviews/audit-18.md);
  - Step 20, the generation engine, built before Step 19 (ADR-0025): `8a3560a` (#50), and its budget test `8332f36` (#51);
  - exam periods by week number and due rules anchored to them (the owner's notes of 21 October, ADR-0026): `b738194` (#53);
  - Step 19, the department plan editor (ADR-0027): `cde2c95` (#54);
  - UX review 2: `77839c2` (#55, docs/reviews/ux-20.md); the privacy record `8a1e94c` (#57);
  - Step 21, assignments (ADR-0028): `4f3fc5f` (#56); Audit 7: `5f3f1b8` (#58, docs/reviews/audit-21.md);
  - the owner's request, the admin's control panel (ADR-0029): `f390291` (#59). It is not a step of section D, and no lead review had seen it, so I review it with the section;
  - Step 22, quick requests and the term readiness board (ADR-0030): `7f3b691`, `4ea0847`, `785f5bd`, `f09f8e4` and `ead6ba8`, with the merges `0ca9fc2` and `5f6f47f`, on `step/22-quick-requests` (PR #60). No audit has read Step 22 or ADR-0029.
  - Merged meanwhile, not the section's work: `a647d46` (#46), `c209713` (#48), `b366ed9` (#37), `64c721d` (#31), `19970be` (#20). My runs show none of them broken: the keys #46 took out came back with their steps (`plan.edit`, `plan.publish`, `assignment.manage`), and those still waiting (`review.decide`, `portfolio.approve`, `indicators.view.college`) are absent.
- Reviewed on `review/lead-D` at `ead6ba8`, 2026-10-23, by the lead-engineer agent. That tree is `main` (`f390291`) with Step 22's branch, PR #60, which becomes `main` when it is squash-merged unchanged, so **I review it as the section's final state.** I did not read GitHub.
- How I ran it:
  - The production build in `.next/standalone`, as CI's checks job runs it, and `pnpm check:all` against an empty database, as CI has it.
  - Five throwaway databases in `college-dev-postgres-1`, all dropped at the end:
    - `lead_d_checks`, empty, for `check:all`;
    - `lead_d_trace` for the statement counts, the timings, the `EXPLAIN`s, the two traces and the write replays, reseeded once between the replays and the traces;
    - `lead_d_journeys` for the journeys on the iPhone 15 emulation;
    - `lead_d_race` for the concurrency, late-joiner and router probes;
    - `lead_d_periods` for the pass after the exam periods move.
  - Every number is at the trial's size, the demo seed's: 47 people, 3 departments, one term in week 9, 853 tasks (section 0, 22 October).
- Verdict: **Section D works as a system on demo data, with 5 must-fix items (about 2 h 40 min) before the `v0.4-D` tag. One item the owner has not decided yet, ADR-0007's client cache, now hides the readiness board's changes, and it is the owner's to decide.**
  - What holds:
    - `pnpm check:all` is green: 133 files, 1071 tests. The full end-to-end suite on the build passes: `321 passed`, `33 skipped` by device or project, none failed, none retried.
    - All 23 actions the section added are in the permission matrix and in `actions-audit`, and every input has a bounded Zod schema.
    - A plan's item reaches its tasks: the publish dialog's "9 مهام" are the 9 tasks the worker's pass makes, and the readiness board's row turns green.
    - A quick request reaches its 3 tasks, its 3 notices and the log.
    - Reads meet section 4's budget one request at a time (p95 36.5 to 81.4 ms). A request to 12 people meets 1 s for writes up to 10 senders at once (p95 987 ms).
    - Every new query uses its index, or reads a small table whole: the engine reads the term's 853 tasks in 0.3 ms. No page sends more statements for more rows.
  - What must be fixed:
    - **M1.** `/assignments` offers to delete a department's own template that someone holds, then refuses it once the head confirms. The page reads every template as never assigned.
    - **M2.** A quick request whose pass fails is kept and logged, but its sender reads "حاول مرة أخرى". Sending it again gives each person two tasks, and the people of the first are never told. The request's pass leaves no record that `/system` or the console can show.
    - **M3.** A quick request tells its people one at a time, with two statements each: 84 statements for the whole college's 42 people.
    - **M4.** Step 22's Done-when, "a head sends a quick request to 12 trainers in under 30 seconds", is timed on the test's robot. By the keystroke-level model Step 19's run uses, the test's own path takes a head about 56 s.
    - **M5.** The readiness board links each row to the page that settles it, even where the viewer cannot open that page. 4 of the vice-dean's 9 links and 6 of the dean's 9 open the refusal page.
  - The owner's item: with `cacheComponents`, the router keeps the pages a person visited and shows them again as they were. The readiness board a vice-dean comes back to by the sidebar still shows a plan as unpublished 20 minutes after it was published. A reload shows the change.

## Must-fix (before tagging `v0.4-D`)

Ordered as found: a page that offers what the server refuses, then the request's reliability, then the plan's rules, then the board's links.

### M1. `/assignments` offers to delete an assigned template, and refuses it after the head confirms

- **Evidence.**
  - `departmentTemplates()` (`src/modules/assignments/server/templates.ts:146`) computes `assigned` with ``sql`exists (select 1 from ${assignments} where ${assignments.templateId} = ${assignmentTemplates.id})` ``.
  - In a select's fields, drizzle writes column names without their table. PostgreSQL's log on `lead_d_trace`, and drizzle's own rendering in `render.ts`, give the same statement:

    ```
    select "id", "department_id", "title", "axis_id", "grants_role_id",
      exists (select 1 from "assignments" where "template_id" = "id") from "assignment_templates" …
    ```

    Inside the subquery, `"id"` is the assignment's own id. The test asks whether an assignment's template is that assignment, which never holds.
  - The same query by hand on the demo seed:

    ```
         title             | own | as_the_page_reads | assigned
     أمين القسم            | f   | f                 | t
     مشرف التخصص           | f   | f                 | f
     مشرف الورش والمعامل   | f   | f                 | f
     منسق الجداول          | f   | f                 | t
     منسق التدريب التعاوني | f   | f                 | f
     مشرف السلامة          | f   | f                 | t
     مسؤول العهد           | t   | f                 | t
    ```

  - The board shows the delete button only when `own && !template.assigned` (`assignments-board.tsx:192`). On the iPhone 15 emulation, the head of Electrical's card for "مسؤول العهد", which محمد الشهراني holds for weeks 13 to 18, offers "حذف القالب". Its dialog then reads "كُلِّف بهذا القالب أحد، فلا يُحذف.", because `deleteTemplate()` checks again and refuses (`delete-assigned.ts`).
  - **Why no test fails.** `e2e/assignments.spec.ts:346-361` deletes a template the test made, which no one holds. `tests/integration/assignments.test.ts:549-559` checks the service's own refusal, and nothing reads `assigned`.
  - The repository's other correlated subquery written this way (`src/modules/notifications/server/manage.ts:54`) is in an update's `where`, where drizzle names the table: it renders `"notifications"."params"`, as it should.
- **Fix.**
  - Write the subquery with drizzle's `exists()` builder, which names its tables, or read the assigned template ids in a second query.
  - Add an integration case: `departmentTemplates()` reads the demo's inventory officer as assigned. Add an end-to-end case: its card offers no delete. Both fail today.
- **Cost:** 15 min.

### M2. A quick request whose pass fails is kept, and its sender is asked to send it again, which doubles everyone's task

- **Evidence.** `request-fails.ts` on `lead_d_trace`, through the build and the head of Electrical's sheet. A check constraint, on that throwaway database only, refuses the tasks of one request's title, as any error inside `generateTerm()` would.

  ```
  1. sent while its pass fails: {"alert":"حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل."}
     left behind: {"requests":1,"events":1,"tasks":0,"notices":0,"runs":0}
  2. sent again, as the sheet invites: {"alert":""}
     now: {"requests":2,"events":2,"tasks":30,"notices":15,"runs":0}
  3. after the worker's next pass: {"requests":2,"events":2,"tasks":30,"notices":15,"runs":0}
     people with two tasks of it: 15
  ```

  - The second request's pass made the first request's tasks too, as the engine reconciles every source of the term. So each of the 15 people holds two identical tasks, and is told of one.
  - Such errors happen: the demo's own seeded failed pass reads "Connection terminated unexpectedly" on `/system`.
- **Why.**
  - `sendQuickRequestAction` (`src/app/(app)/requests/actions.ts:25-56`) commits the request and its event, then calls `generateTerm()` and `notify()` outside that transaction. An error after the commit reaches the sheet as `serverError`, which the sheet words as "try again".
  - The pass runs inline, outside `generation_runs`, so it leaves no record:
    - `/system` and the console's "the open terms whose latest pass failed" never see a request's pass, or its failure;
    - `/framework`'s card keeps the previous run's count: "862 مهمة في الفصل" after trace 2's request made the term 865;
    - migration `0028`'s inverse deletes "the passes the requests caused", and no run records any.
- **Fix.**
  - In one transaction, keep the request and queue its pass, a run whose reason is `request`.
  - Then run that run in the request, as `runQueued()` runs one, so it is recorded as done or failed.
  - If the pass fails, answer `sent` with the words that its tasks come within the minute. The worker takes the run up.
  - Tell the request's people from the pass that makes their tasks. The `onceKey` keeps each person told once, whoever runs it. This is also where M3's single statement goes, and the seed then calls the same function rather than its copy of the action (`db/seed/demo/requests.ts:160-200`).
  - Integration test: with the probe's constraint, the action answers `sent` with its tasks pending; once the constraint goes, the worker's run makes each task once and tells each person once.
- **Cost:** 1 h.

### M3. A quick request tells its people one at a time

- **Evidence.** PostgreSQL's log, with `log_statement = 'all'` on `lead_d_trace` only:

  | Send | Reached | Statements of the action | Of them, the notices | Of them, the college's settings |
  | --- | --- | --- | --- | --- |
  | The head, to 12 people of Electrical | 12 | 84 | 24: `notification_prefs`, then `insert into notifications`, for each person | 17 |
  | The vice-dean, to everyone in the college | 42 | 143 | 84 | 16 |

  The action's statements run from its session read to its last notice, before the page is drawn again.

  The loop is `for (const { userId } of reached) await notify(…)` (`actions.ts:41-54`). `notify()` reads the person's preference, then inserts (`src/modules/notifications/server/notify.ts:25-48`).
  - Lead review C made pages that query once per row must-fix (its M3). This is the same rule on a write.
- **Fix.**
  - One `insert … select` over the request's tasks' assignees that leaves out whoever turned the kind off, `on conflict (user_id, once_key) do nothing`.
  - Test: the same statement count for 1 person as for 12, with `tests/integration/support/plans.ts`'s recorder.
  - With M2's fix, it runs from the pass.
- **Cost:** 20 min.

### M4. Step 22's Done-when is proven on the robot, not on a head

- **Evidence.**
  - `e2e/requests.spec.ts:44-79` times the browser from `page.goto("/requests")` to the toast, under 30 s. It ticks 12 of the 16 people its list shows (the head among them), one by one.
  - The same path, counted with the keystroke-level model that `e2e/plan.spec.ts:464` uses for Step 19's run (1.35 s to decide, 1.1 s to point, 0.2 s to press, 0.28 s a character):

    | Path from `/requests` | Taps | Fields | Modelled | Reaches |
    | --- | --- | --- | --- | --- |
    | The test's: the title (25 characters), today, "أشخاص أختارهم", 12 ticks, send | 19 | 1 | 56.0 s | the 12 |
    | The same with the axis chosen ("المحور 6"), as a request for attendance sheets needs, and my 29-character title | 21 | 1 | 61.1 s | the 12 |
    | "حاملو دور" and "المدرب", the axis chosen | 11 | 1 | 33.2 s | the role's 15 holders |
    | "الجميع", the sheet's default, the axis chosen | 7 | 1 | 25.3 s | the 15 people but the head |

    My phone runs from Today add the two taps of "المزيد" and the page: 66.4, 38.5 and 30.6 s (part 6).
  - Audit 7's major 2 found the same of Step 19's 30-minute run, which now counts a head by this model.
- **Fix.**
  - Move `modelledHead()` to `e2e/support/` and time the request with it.
  - Ask the owner which 12 the Done-when means:
    - **a department's trainers** (the trial has about 13 a department): the test sends to the trainer's role or to everyone and models about 25 to 33 s;
    - **12 people chosen among more**: no list of ticks can do it in 30 s, as the title alone takes 10.8 s. Proposal 4 brings it to 33 to 37 s.
  - Record the answer under Step 22.
- **Cost:** 45 min.

### M5. The readiness board's links lead the vice-dean and the dean to pages that refuse them

- **Evidence.** `board-links.ts` follows each row's "افتح" on the demo seed:

  | Row | Its page | Vice-dean | Dean | Head of Electrical |
  | --- | --- | --- | --- | --- |
  | تفعيل الفصل | the term's page | opens | opens | opens |
  | نشر الإطار العام | `/framework` | opens | opens | opens |
  | منسوبو الأقسام | `/people` | **refused** | **refused** | opens |
  | تقارير رايات, مطابقة مدربي رايات | `/rayat` | opens | **refused** | opens |
  | خطة القسم, a row for each department the viewer sees | `/plan?department=…` | **refused**, 3 rows | **refused**, 3 rows | opens, 1 row |

  So 4 of the vice-dean's 9 links, and 6 of the dean's 9, open "هذه الصفحة خارج صلاحياتك".
- **Why.**
  - `termReadiness()` gives each row the page that settles it, for its owners (`src/modules/readiness/server/board.ts:117-176`).
  - The page draws that link for every viewer (`src/app/(app)/readiness/page.tsx:148-158`), while each page asks for its own key. The shell, by contrast, offers no page its viewer cannot open.
  - **Why no test fails.** `e2e/requests.spec.ts:147-158` follows only the framework row's link, which the vice-dean owns.
- **Fix.**
  - Draw a row's link only where the viewer opens its page: each row names the key its page asks for, and the board checks it with `authorize()`. The row's owners stay named.
  - End-to-end test: the dean's board links the term and the framework alone. It fails today.
  - Proposal 3 gives the plan rows a page for both of them.
- **Cost:** 20 min.

## The owner's item: ADR-0007's client cache hides the readiness board's changes (lead review A's proposal 3)

- **Then.** Lead review A asked the owner to decide ADR-0007: keep `cacheComponents` and `partialPrefetching` and record why, or remove both. It waits in docs/BACKLOG.md.
- **Now.**
  - Step 22's board, ADR-0029's console and `/system` are the first pages whose purpose is to show what other people did since.
  - Next.js 16 keeps the last pages a person visited mounted, hidden in an `<Activity>` boundary, "to preserve their state if or when the user navigates to them again" (`node_modules/next/dist/client/components/layout-router.js:386-389`). It keeps three with `cacheComponents` and one without (`MAX_BF_CACHE_ENTRIES`, `bfcache-state-manager.js:13`). So a page stays as it was drawn until the person has visited three others, however long that takes.
  - `stale-board.ts` on `lead_d_race`, desktop:
    1. the vice-dean opens `/readiness`, where General Studies' plan row is open;
    2. they go to Today by the sidebar;
    3. the plan is published in the database meanwhile;
    4. they come back to `/readiness` by the sidebar.

    ```
    back by the sidebar after 2 s:    خطة الدراسات العامة · لم يكتمل · لم تُنشر خطة القسم بعد
    back by the sidebar after 35 s:   … لم يكتمل …
    back by the sidebar after 310 s:  … لم يكتمل …
    back by the sidebar after 1200 s: … لم يكتمل …
    after a reload:                   خطة الدراسات العامة · مكتمل · نُشرت خطة القسم
    ```

  - `/requests` behaves the same: a request sent by someone else is missing 5 s later, and shows after a reload (`stale-requests.ts`).
  - In journey 4b, the admin added the trainer the board's first open row named and came back to the board by the tab bar. It still read "لم يكتمل" while a fresh load read "مكتمل".
- **Recommendation.**
  - Decide ADR-0007 before Step 23, whose Today pages will show the same behaviour.
  - Whatever the decision, the board, the console and `/system` should read again each time they are shown. For example, a small client component can call `router.refresh()` when its route becomes visible again, with an end-to-end test that comes back by the sidebar.
- **Cost:** about 45 min for the three pages. The decision is the owner's.

## Proposals, ranked by benefit over cost

| # | Proposal | Benefit | Cost | Plan change |
| --- | --- | --- | --- | --- |
| 1 | The board counts a trainer whose account is disabled as unmatched | The board's "every trainer on the platform" then means someone can do the section's tasks. The demo has the case today: General Studies' section 30101 belongs to بدر المطيري, whose account is disabled. He holds 8 live tasks, and the board reads "مكتمل" | 30 min | no; a note under Step 22 |
| 2 | A quick request reaches the people it reached when it was sent | Someone who joins a department later gets every earlier request to "everyone" or a role, already overdue, and is never told. In a probe, someone joined after a request due 29 October; the next pass, dated 1 November, gave them its task, and no notice went out | 45 min | ADR-0031, amending ADR-0030 |
| 3 | The vice-dean and the dean read a department's plan | Section 1 says the vice-dean sees every department "read only", and the board shows both of them each department's plan row. Yet `/plan` opens only for `plan.edit` or `plan.publish`, so neither can read a plan, and with M5's fix those rows have no page for them | 45 min | no; a note under Step 19 |
| 4 | The request sheet for a group: "tick all shown" and this week's due day by default | From `/requests`, 12 people of 16 go from 21 taps and 61 s by the model to 12 taps and 37 s, or 10 taps and 33 s with the axis left as it is | 45 min | no |
| 5 | The board reaches the owners of its open rows | Today the vice-dean reads that the first open row waits on the admin, and nothing on the platform lets him tell her. The admin's console would list the board's open rows that are theirs, which ADR-0029 already allows. Each row would offer "ذكّرهم", which tells its owners | 1.5 h | ADR-0032 |
| 6 | A request's day is a working day, and not a holiday | Trace 2's request is due Saturday 24 October, a day off. Every other task is due on its week's last working day (ADR-0025) | 20 min | a note under Step 22 |
| 7 | One pass at a time per term, a request's own included | The worker runs queued passes one at a time "so a pass never writes over a later one" (`worker/start.ts:51`). A request's inline pass is outside that rule. A pass that reads its sources before a request is kept and its tasks after the request's own pass would cancel that request's tasks. None of my 320 concurrent sends hit it | 30 min | no |
| 8 | The assign sheet's weeks show their dates, and start from this week | The head picks "الأسبوع 10" from a list of 18 numbers without dates, where the transfer sheet gives each week its dates | 20 min | no |

### 1. The board counts a trainer whose account is disabled as unmatched

- **Now.**
  - `unmatchedTrainers()` (`src/modules/academics/server/sections.ts:344-362`) treats any person with the employee number as matched, whether or not their account is disabled.
  - The engine gives a section's tasks to its trainer's account, enabled or not (`termInputs()`'s `accounts`).
  - Trace 1's 9 tasks include one for course "عام 101", place 200003: بدر المطيري, the demo's disabled trainer. In all, he holds 8 live tasks (framework and plan) that no one can sign in to do.
  - The board's row reads "لكل مدرب في جداول الشعب حساب على المنصة", so it is green.
- **Proposal.**
  - `unmatchedTrainers()` returns the disabled accounts apart.
  - The row counts both, and reads "N بلا حساب، وM حسابه معطَّل". `/sections` marks such a section's trainer as disabled, as it already marks one not on the platform.
  - The owner's rule stays: the task waits for the account.
- **Cost:** 30 min.

### 2. A quick request reaches the people it reached when it was sent (ADR-0031)

- **Now.**
  - ADR-0030 makes a request a source that every pass reconciles, so whom "everyone" or a role reaches is read again at each pass. The nightly pass reaches whoever began holding a role (ADR-0025).
  - The notices go out only in the action.
  - `late-joiner.ts` on `lead_d_race`:

    ```
    sent to everyone in Electrical, due 2026-10-29: 16 tasks, each person told once
    the joiner's task of the request: [{"due":"2026-10-29","week":10,"status":"notStarted","alive":true,"told":0}]
    due 2026-10-29, the pass ran on 2026-11-01
    ```

  - On that database, my concurrency probe had sent 230 requests to everyone across the three departments. The joiner's first pass made 91 tasks for them: 79 for earlier requests to Electrical, all of them already due, and 12 of the framework's.
  - Audit 7 left the owner one case of tasks overdue at once: an assignment whose weeks are over. This is a second.
- **Proposal.** The owner chooses:
  - **the reach is fixed when the request is sent:** keep the people reached (the targets resolved) and let the engine reconcile those alone. This is closest to "urgent work sent to whom you choose";
  - **or the reach stays live:** a request reaches someone only if they held the role before its day, and the pass tells whoever it reaches. M2's fix makes that one statement.
- **Cost:** 45 min, with an integration case for each.

### 3. The vice-dean and the dean read a department's plan

- **Now.**
  - Section 1 gives the vice-dean every department "down to trainer, section, task and evidence, read only".
  - `/plan` calls `forbidden()` for whoever holds neither `plan.edit` nor `plan.publish` (`src/app/(app)/plan/page.tsx:57-68`). The vice-dean and the dean hold neither, and `board-links.ts` shows both refused.
  - The editor already reads without editing: for a publisher without `plan.edit` (Audit 7), and for a closed term.
- **Proposal.**
  - `/plan` opens read-only, one department at a time, to whoever holds `readiness.view` across the college, or to a key the owner chooses.
  - The board's plan rows link there for them.
- **Cost:** 45 min, with an end-to-end test as the dean.

### 4. The request sheet for a group of people

- **Now.** Journey 3a: ticking 12 of 16 is 12 decisions and 12 taps, 31.8 s of its 61.1 s. Choosing the day is 2 taps, and the axis 2 more.
- **Proposal.**
  - "اختر كل الظاهرين" ticks everyone the search shows.
  - The day starts on this week's due day, or the next one once it has passed.
  - With both, 12 of 16 is 1 tap plus 4 unticks. From `/requests` that is 12 taps and 37 s by the model, or 10 taps and 33 s with the axis left as it is. "Everyone" stays 25 s.
- **Cost:** 45 min, with a phone test.

### 5. The board reaches the owners of its open rows (ADR-0032)

- **Now.** Journey 4a: the vice-dean opens the board and its first open row, "مطابقة مدربي رايات … يتولاه هند القحطاني", in 3 taps. Its link opens `/rayat`, which says that whoever manages people adds the trainer. Neither page can tell the admin. The vice-dean's next open row, General Studies' plan, waits on its head. The admin's own path (4b) is 4 views and 9 taps once she knows.
- **Proposal.**
  - The console's "what needs attention" lists the board's open rows whose owners include the viewer, each linking to the row's page. For the matched row, that is the add flow of ADR-0022. ADR-0029 already says they can join it.
  - An open row offers "ذكّرهم" to whoever sees the board: one notification kind to its owners, at most once a day per row. Step 27 decides how reminders are worded together.
- **Cost:** 1.5 h.

### 6. A request's day is a working day

- The sheet's picker offers every day between today and the term's last counted week (`requests/page.tsx:159-167`). `sendQuickRequest()` checks only that the day falls in a counted week (`requests.ts:63-71`), so a Friday, a Saturday, or a holiday inside a counted week is accepted.
- The picker should disable the days `calendarOf()` does not count as working, and the service should refuse them with a reason of their own.
- **Cost:** 20 min.

### 7. One pass at a time per term

- `generateTerm()` reads its sources, then the term's tasks, in separate statements, then writes each department in its own transaction (`src/modules/tasks/server/generate.ts:347-403`).
- Two passes of one term can run at once only when one is a request's. A pass whose sources predate a request but whose task read follows that request's own pass would cancel the request's tasks, which are not started. The next pass revives them, but untold.
- `race.ts` sent 230 requests through the services in bursts of 2 and 3, with and without a worker pass beside them, and `replay.ts` sent 90 more through the server at up to 10 at once. No task was lost, because the window is a few milliseconds.
- A transaction-level advisory lock on the term, held from the first read to the last write, closes it. M2's fix, where the request's pass is a run, makes this the natural place.
- **Cost:** 30 min, with a test that holds the lock and shows the second pass waiting.

### 8. The assign sheet's weeks

- "من الأسبوع" and "إلى الأسبوع" list "الأسبوع 1" to "الأسبوع 18" with no dates, and start on week 1 (`assign-sheet.tsx:55-56`, `:116-141`).
- Give each option its dates, as the transfer sheet's does, and start "from" on this week.
- **Cost:** 20 min.

### Smaller items, each under 15 minutes

- The board's "توليد المهام" row names the framework's publishers when the last pass failed, and links `/framework`, whose card can only say it will retry tonight. Whoever reruns it holds `system.manage` on `/system`: name them and link there when the run failed.
- A request reads the college's settings table 16 or 17 times: `calendarSettings()`, `getSetting()` and next-intl's request configuration each read it again, in the service, in the pass and for the notice's date. Read the settings once and pass them down.
- `tasks.holder_id` is `on delete cascade` (`src/modules/tasks/server/schema.ts:56-58`). Deleting an account would delete its role tasks, finished ones too. Nothing deletes accounts today; `restrict` keeps "history is append-only".
- The `quickRequest` notice opens `/today`. In trace 2, that page then read "لا شيء مطلوب منك الآن" right after telling the trainer of a task due that day. For Steps 23 and 26: the notice should open the task.
- The `quickRequest` kind's hint reads "حين يطلب منك رئيس قسمك أو العمادة عملًا عاجلًا.". It names roles a college may rename, the pattern UX review 2's S3 asks to drop.
- `/texts?q=` is the section's slowest read: p95 81.4 ms one at a time, 763 ms at 10 at once and 1,989 ms at 20. It flattens and searches the whole catalog on each request. Flatten it once per process.

### Earlier reviews' proposals that this section bears on

They wait for the owner in docs/BACKLOG.md. I do not rank them again; the section's evidence changes their weight:

- **Lead review B, proposal 4: one helper for the actions' glue.**
  - Its trigger, "take it with the next step that adds a sensitive action", was met by ADR-0029, whose session and sign-out actions ask for the password again. The helper was not taken.
  - Copies now: `changeBy()` ×9, `drawn()` ×4, the password schema ×5 and `confirmPassword()` ×3.
- **Lead review A, proposal 3: decide ADR-0007.** The owner's item above.
- **Lead review A, proposal 6: a load level for the server budget.**
  - At 10 requests at once, 13 of my 17 page measurements exceed 300 ms at p95: 339 to 763 ms. At 20, they reach 717 to 1,989 ms.
  - A request to 12 people at 10 at once: p95 987 ms against 1 s.
- **Lead review A, proposal 10: migrations expand, then contract.** `0023` moved the section templates into plans, and `0024` dropped their table in the same release. `0022` rewrote the framework's "after each exam" rules as `examPeriods`. By reading `0715dec`, `v0.3-C`'s image on this schema has no case for that rule in `occurrences()` or in `/framework`'s words for it, so its preview's count would not be a number and the rule would show no words. I did not run it.
- **Audit 7's two choices for the owner**: an empty draft is never published, and an assignment whose weeks are over is accepted, its tasks overdue at once. Proposal 2 is a second way a task arrives overdue.

### Proposed ADRs

| ADR | Decision |
| --- | --- |
| **ADR-0031, whom a quick request reaches** (proposal 2, if accepted) | A request reaches the people it reached when it was sent. Or, if the owner keeps the reach live, someone who began holding the role before its day, and the pass tells whoever it reaches. |
| **ADR-0032, the board tells the owners of its open rows** (proposal 5, if accepted) | The console lists the open rows that are the viewer's, and a row's owners can be reminded from it, with a notification kind of its own. |

ADR-0011 and ADR-0012 stay reserved for lead review A's pending proposals, and ADR-0013 is unused. ADR-0030 is the latest, so the new ones start at 0031. M2's fix keeps ADR-0030's "tasks at once" and needs no ADR. Proposals 1 and 6 refine ADR-0030's board row and request day, and proposal 3 carries out section 1's word for the vice-dean; a note under Steps 19 and 22 records each.

## Evidence

### 1. Commands run

| Command | Result |
| --- | --- |
| `pnpm build` with empty `APP_URL`, `DATABASE_URL` and `AUTH_SECRET` as in CI, the static files and `public` copied into `.next/standalone` (`ux20-build.sh`) | exit 0 · `✓ Compiled successfully` · `✓ Generating static pages using 3 workers (44/44)` |
| `ux20-e2e-all.sh`: `college` dropped and reseeded, then `CI=1 pnpm exec playwright test -c e2e/dev.local.config.ts --grep-invert @visual` on the build, desktop and iPhone | `seed:demo finished with --seed 42 --week 9` · `Running 354 tests using 2 workers` · `33 skipped` · `321 passed (10.4m)`. No test failed or was retried. Each skip comes from a spec's `test.skip`: by phone, desktop or touch screen; one project of a setting changed once; and WebKit's spec on Chromium |
| `pnpm check:all` with `DATABASE_URL` on the empty `lead_d_checks`, `TESTCONTAINERS_RYUK_DISABLED=true` | exit 0 in 144 s · `Checked 734 files in 809ms. No fixes applied.` · `Test Files  133 passed (133)` · `Tests  1071 passed (1071)` · `check:hardcode passed.` · `✔ no dependency violations found (625 modules, 2972 dependencies cruised)`. One `DeprecationWarning` from pg, the one audit-12 lists among its known limits |
| `pnpm check:unused` · `drizzle-kit generate` on a copy of HEAD (`git archive`) | knip exit 0 · `No schema changes, nothing to migrate` |
| `db:migrate`, `db:seed`, `seed:demo` on each throwaway database | about 19 s each. `lead_d_trace`: people 47, live tasks 853 (framework 692, plan 107, assignment 33, request 21), quick requests 3, plans 2 published and 1 draft with 17 items in all, assignments 6, passes 2 (one failed), notifications 162, audit events 584 |
| My standalone servers (ports 3300 to 3302) and a worker on `lead_d_trace` | Parts 2, 4 and 6 |

The production images cannot be built here: Docker builds have no network. CI's "Production stack" job covers them. Its smoke lists the section's `plan.spec.ts`, `assignments.spec.ts`, `requests.spec.ts` and `control-panel.spec.ts`, and `tests/unit/stack-specs.test.ts` passes.

### 2. Integration: two records traced

No PDF exists yet (Step 32), and no trainer's screen lists tasks yet (Steps 23 and 24). Both traces therefore end at the database, the notices, the log and the screens that report on tasks.

**Trace 1: an item of General Studies' plan**, on the build with a worker (`trace-plan.ts`, `lead_d_trace` reseeded). The demo leaves General Studies without a plan, so its head, عبير الرشيدي, starts one.

| Where | What it shows |
| --- | --- |
| `/readiness`, the vice-dean, before | "خطة الدراسات العامة · لم يكتمل · لم تُنشر خطة القسم بعد · يتولاه عبير الرشيدي"; the plans of Electrical and Mechanical "مكتمل" |
| `/plan`, the head | the empty state, then "بدء الخطة", then the sheet: "ملف المقرر الإلكتروني", for each course's trainer, week 11 |
| The sheet's toast | "حُفظ البند. يقع في الأسبوع 11." |
| The draft and its publish dialog | "تُنشئ المسودة 9 مهام لمنسوبي القسم في الفصل. نحو مراجعتين في الأسبوع: 36 مهمة تطلب الاعتماد في 18 أسبوعًا، منها 36 من الإطار العام. أكثرها في الأسبوع 4: 9 مراجعات." |
| After publishing | "نُشرت النسخة 1، وتُولَّد مهام القسم منها خلال دقيقة."; the page reads "النسخة 1 منشورة منذ 24 أكتوبر 2026" and offers "بدء النسخة 2" |
| The worker's pass | queued at publishing, done 40.4 s later: `created 9`, total 862 |
| `tasks` | 9, one for each place of each of the department's courses, week 11, due Thursday 5 November, not started. **The preview's 9 is the pass's 9.** One is بدر المطيري's, whose account is disabled (proposal 1) |
| `/readiness`, after | "خطة الدراسات العامة · مكتمل · نُشرت خطة القسم" on a fresh load. Coming back by the sidebar instead keeps the earlier render (the owner's item) |
| `/framework`, the vice-dean | "862 مهمة في الفصل، وُلِّدت بعد نشر خطة قسم … أُنشئت 9، وعُدِّلت 0، وانتقلت 0 إلى مدرب آخر، وأُلغيت 0." |
| `/system`, the admin | the pass first, "تمّ نشر خطة قسم"; below it, the seed's failed nightly pass, "Connection terminated unexpectedly" |
| `/console` and `/audit` | `plan.create`, `planItem.create` (with its week, kind and reach), `plan.publish` (version 1, 1 item) and `task.generate` (cause "نشر خطة قسم", 9 created), each with its actor; the system for the pass |
| The 9 trainers | nothing yet. Their Today reads "لا شيء مطلوب منك الآن", and nothing tells them (Steps 23, 24 and 27) |

**Trace 2: a quick request** from the head of Electrical to three of its trainers, the demo trainer among them (`trace-request.ts`).

| Where | What it shows |
| --- | --- |
| The trainer's bell, before | "الإشعارات، لا جديد" |
| The sheet | the title, today, "أشخاص أختارهم", three ticks; the toast "أُرسل الطلب، ووصل 3 أشخاص" |
| `/requests`, the head and the vice-dean | "تسليم كشوف حضور الأسبوع · التقنية الكهربائية · التسليم السبت، 24 أكتوبر 2026 · 3 أشخاص اختارهم مرسله · يطلب شاهدًا · أرسله ماجد الدوسري …" |
| `quick_requests` | its targets, and its evidence fixed when sent: the college's 8 accepted types, one file, required, no approval |
| `tasks` | 3, general, week 9, due 2026-10-24, a Saturday (proposal 6) |
| `notifications` | 3 `quickRequest`, each with the title, "السبت، 24 أكتوبر" and the sender |
| The trainer | the bell "إشعار جديد"; the notice "تسليم كشوف حضور الأسبوع · طلبه ماجد الدوسري، وموعده السبت، 24 أكتوبر."; it opens `/today`, which reads "لا شيء مطلوب منك الآن" |
| The log | `quickRequest.send`, worded "إرسال طلب سريع «…» · التقنية الكهربائية …" with its day, axis, reach and evidence; then `task.generate`, cause "طلب سريع", 3 created |
| `/readiness`, `/framework`, `/system` | unchanged: the request's pass is not a run (M2) |

### 3. Architecture

- **Boundaries.**
  - `pnpm check:boundaries` is green (625 modules). No import in `src`, `worker` or `db` reaches past another module's `index.ts`.
  - The new modules, `requests`, `readiness`, `system` and `texts`, keep their pure parts in `domain/`: the request's input, the catalog's checks and the worker's state.
  - `tasks` imports `requests` for its items. The send's orchestration therefore sits in the action, and the seed copies it (M2's fix).
- **The model.**
  - One idea, the slot (ADR-0025), carries every source: framework, plan, assignment and request.
  - The plan absorbed the section templates (ADR-0027), so a department has one list.
  - A request is a source, not a plan item (ADR-0030), which keeps plans' versions to what a department planned.
- **Duplicated logic:**
  - the action glue (lead review B's proposal 4, above);
  - the send's flow in the action and the seed;
  - the settings read again within one send (smaller items).
- **Locks.**
  - A plan's changes lock their draft row, and starting a draft takes the college's lock.
  - Assigning relies on the holder's unique key, revoking locks its row, and a department's own templates take the college's lock.
  - A text locks its row, and a session's actions lock the account.
  - Passes are one at a time in the worker, but not against a request's inline pass (proposal 7).
- **Migrations `0020` to `0028`** match the schemas, and each states its inverse in its header.

  | Migration | What it does | Its inverse |
  | --- | --- | --- |
  | `0020` | `section_templates`; `plan.edit` for heads | Stated: drop it, take the key |
  | `0021` | `tasks`, `generation_runs`, `framework_items.origin_id` | Stated. The tasks are lost with it |
  | `0022` | `exam_period_types`, `exam_periods`; anchored rules; exam events become the college's own | Stated. The exam events stay the college's own: partly one-way, and said so |
  | `0023` | `plans`, `plan_items`; templates become first drafts; `plan.publish` for heads | Stated: back into `0020`'s table |
  | `0024` | drops `section_templates` | Stated: `0020`'s table, which `0023`'s inverse fills. A contract step in the same release as `0023` (lead review A's proposal 10) |
  | `0025` | the default roles' page order | Stated: only where still the default |
  | `0026` | assignment templates, items and assignments; `assignment.manage` | Stated, with the memberships the assignments added |
  | `0027` | `worker_heartbeats`, `text_overrides`, the cause `admin` | Stated |
  | `0028` | `quick_requests`, the source and cause `request`, the two keys | Stated. Its "passes the requests caused" are never recorded today (M2) |

### 4. Data and speed

**Statements per request**, one warm request each, `lead_d_trace` with `log_statement = 'all'` on that database only:

| Page | Statements | Read more than once |
| --- | --- | --- |
| `/today` trainer · head | 15 · 16 | `notifications` 3, `terms` 2 to 3 |
| `/texts`, with or without a search | 16 | `text_overrides` 2, read once per request for the messages and once for the page |
| A term's page (the exam periods) | 20 | `terms` 3 |
| `/system` | 22 | `sessions` 2 |
| `/requests` head · vice-dean (1 and 4 places) | 25 · 25 | `memberships` 3 |
| `/framework` vice-dean | 28 | |
| `/assignments` head | 30 | `memberships` 4, `assignments` 2 |
| `/plan` head · admin | 35 · 35 | `memberships` 4 |
| `/readiness` head · vice-dean · dean (1 and 3 plan rows) | 35 · 35 · 35 | `memberships` 9: one per key it names owners for, fixed |
| A person's page (sessions) | 39 | `role_permissions` 4 |
| `/console` | 44 | `role_permissions` 4 |

The vice-dean's board has three plan rows, and the head's has one. The vice-dean's `/requests` has four places, and the head's has one. Each pair sends the same number of statements, so no page of the section reads once per row. The one statement per row is M3's, in a write.

**Indexes.** `EXPLAIN (ANALYZE)` on `lead_d_trace` (`explain.sql`):

- **Uses its index:**
  - a term's requests: `quick_requests_term_idx`, 0.28 ms;
  - whom a request told: `tasks_slot_unique`, 0.07 ms;
  - a term's published plans: `plans_version_unique`, 0.13 ms;
  - the latest pass: `generation_runs_term_idx`, 0.07 ms;
  - the worker's claim, each minute: `generation_runs_waiting_idx`, 0.05 ms;
  - a department's assignments: `assignments_holder_unique`, 0.16 ms;
  - the college's texts, on every request: `text_overrides_key`, 0.04 ms;
  - a person's sessions: `sessions_user_id_idx`, 0.08 ms;
  - a person's mute of a kind: `notification_prefs`'s key.
- **Reads the whole table, by design or by size:**
  - the engine's read of a term's tasks: 853 rows, 0.32 ms, all of them this term's; `tasks_term_department_idx` serves it once terms accumulate;
  - `roleHolders()` and `holdersAcross()`: 50 memberships, 0.3 to 0.4 ms;
  - `listRuns()`: 2 runs, with no index on the college. A nightly run per open term adds about 365 rows a year, which a sort reads in well under 1 ms.

**Server p95 in ms**, the standalone build, demo data, 60 requests per level after a warm-up, the client on the same 4 vCPU machine (`timing.ts`):

| Page | 1 | 10 | 20 |
| --- | --- | --- | --- |
| `/plan` head · admin | 79.2 · 64.0 | 494.6 · 474.0 | 927.1 · 913.3 |
| `/assignments` head | 56.9 | 478.6 | 1,104.0 |
| `/requests` head · vice-dean | 41.8 · 47.6 | 339.1 · 283.8 | 981.6 · 1,205.9 |
| `/readiness` head · vice-dean · dean | 49.8 · 50.5 · 53.6 | 362.7 · 374.5 · 391.2 | 827.8 · 774.1 · 716.7 |
| `/framework` vice-dean | 57.6 | 410.3 | 762.5 |
| A term's page | 60.1 | 690.6 | 1,528.0 |
| `/console` | 56.8 | 450.8 | 868.3 |
| `/system` | 48.6 | 281.1 | 771.4 |
| `/texts` · with a search | 44.5 · 81.4 | 268.2 · 763.2 | 946.7 · 1,988.7 |
| A person's page | 58.6 | 466.9 | 857.7 |
| `/today` trainer · head | 36.5 · 40.3 | 376.9 · 247.0 | 823.7 · 1,098.4 |

- **Writes.** Real action requests, captured from the screens and replayed (`capture.ts`, `replay.ts`). Each replay is a real write: every replayed request made its 12 tasks and 12 notices.

  | Write | 1 at a time | 5 | 10 | 20 |
  | --- | --- | --- | --- | --- |
  | A quick request to 12 people (30 per level) | 168.3 | 476.0 | 987.2 | |
  | A plan item (60 per level) | 76.9 | | 511.4 | 1,034.2 |

  Further timings:
  - the whole college's request to its 42 people: 449 ms in the browser, with statement logging on;
  - a pass after every exam period moves a week rewrites 183 tasks in 364 ms, one update each, in the worker, and a second pass changes nothing in 48 ms (`periods-pass.ts`);
  - the plan's pass in trace 1 ran 40.4 s after publishing, the worker's minute.
- **Against section 4.**
  - Every read meets 300 ms one at a time.
  - Every write meets 1 s up to 10 at once. At 20 at once, a plan item takes 1,034 ms.
  - At 10 at once, most pages miss the read budget. The load level is the owner's (lead review A's proposal 6).

### 5. Security

- **Permission matrix and audit test.**
  - The section's 23 actions are in both, and both tests find every exported action through `import.meta.glob`:
    - 6 for the plan;
    - 1 for the exam periods;
    - 8 for assignments;
    - 3 for a person's sessions;
    - 2 for the system page;
    - 2 for the texts;
    - 1 for quick requests.
  - Audit 7's matrix role, which holds every key but the action's own, is refused each of the 23, so no action checks a neighbouring key such as `plan.edit` for `plan.publish`.
  - A department's request needs `requests.send` in its department. The whole college's needs it across the college, and the matrix has both rows. Chosen people must belong to the request's department (`targetsFit()`) and hold a role there for the term.
  - The control panel's keys are two-factor keys. Ending another person's sessions, requiring their new password, and signing everyone out ask for the password again once it was typed too long ago (`auth.reauthMinutes`), as the other sensitive actions do. One's own sessions are never listed.
- **Inputs.** Every action takes a bounded Zod schema:
  - a request's title, at most 200 characters on one line, and at most 500 people, each once;
  - a day as an ISO date, then held to the term's counted weeks and today;
  - a text's key at most 200 characters and its wording at most 5,000, which must parse as ICU and keep the default's arguments and tags;
  - a plan's items as Audit 7 found them.
- **Texts.** A college's wording is laid over the catalog and rendered as text. No message reaches `dangerouslySetInnerHTML`, and `t.raw` reads only the design catalog's sample lists, which the texts page excludes.
- **Files.** The section stores none. A request's evidence policy names types, and Step 25 adds the upload.
- **Findings:** none of M1 to M5 is a security finding. M1 and M5 offer what the server then refuses, which is what the server should do.

### 6. The section's journeys, counted

Each journey ran on the iPhone 15 emulation of the production build (`journeys.ts`, `lead_d_journeys`), from Today:

- "Views" are the pages the phone showed after Today.
- A tap includes the one that focuses a field, and a tap on a select's option. The system keyboard is not counted.
- "Modelled" is a person's time by the keystroke-level model of `e2e/plan.spec.ts`.

| # | Journey | Role | Views | Taps | Fields | Modelled | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Adds an item to the department's draft, a grade analysis for each section's trainer a week after each periodic exam, and publishes the draft | head | 1: `/plan` (a tab) | 18 | 1 (34 characters) | 50.5 s | 10 taps are 5 selects, and 2 more untick the finals; the toast names "الأسبوعين 7 و13"; the dialog "تُنشئ المسودة 146 مهمة … نحو 3 مراجعات في الأسبوع". The whole plan: Step 19's 50-item run models 13.0 minutes against 30, and passed in my suite run |
| 2 | Gives "مشرف الورش والمعامل" to two people for weeks 10 to 14 | head | 1: `/assignments` (under "المزيد") | 11 | 0 | 26.5 s | the weeks are numbers without dates (proposal 8); nothing tells the two (docs/BACKLOG.md, Step 21) |
| 3a | Sends a quick request to 12 of the 16 people the sheet lists, each ticked | head | 1: `/requests` (under "المزيد") | 23 | 1 (29 characters) | 66.4 s | 12 of the taps are the ticks (M4, proposal 4) |
| 3b | The same to the trainer's role | head | 1 | 13 | 1 (29) | 38.5 s | reaches 16: the demo's 15 and the visitor journey 4b had added |
| 3c | The same to everyone, the default | head | 1 | 9 | 1 (29) | 30.6 s | reaches the same 16 |
| 4a | Reads the readiness board and opens its first open row | vice-dean | 2: `/readiness` (under "المزيد") > `/rayat` | 3 | 0 | 8.0 s | the row waits on the admin, and `/rayat` says who adds the trainer; he cannot settle it or tell the admin (proposal 5) |
| 4b | Settles that row | admin | 4: `/readiness` > `/rayat` > `/people/new?number=209001…` > `/readiness` | 9 | 2 (40 characters) | 35.0 s | ADR-0022's link fills the number, department and role. Back on the board by the tab bar, the row still read "لم يكتمل" (the owner's item) |

- **Proposals 4 and 5** and **M4** shorten journeys 3 and 4.
- The other journeys are as short as their outcomes allow:
  - an item's fields, which the plan lists, with the sheet keeping them from one item to the next;
  - a confirmation before publishing a version that never changes;
  - two people and two weeks for an assignment.
- Step 23 brings the quick request's button and the board to Today, which saves the two taps of "المزيد" in journeys 3 and 4.
- **Touch targets and axe** were covered by the suite's iPhone tests on every screen of the section (all passed), so I did not measure them again.

## Owner items

Unchanged, and I found none of them broken:

- the tags `v0.1-A`, `v0.2-B` and `v0.3-C`;
- the "Production stack" required check;
- the Wi-Fi phone test;
- ADR-0007 (the owner's item above) and ADR-0010;
- the logo and the font licence;
- SO01's original headers;
- the official list of axes, whose titles are still provisional;
- the design catalog's visual baselines from CI.

## How this review left the environment

- **Databases.**
  - `college` was dropped and reseeded by the build script, then by the suite's, and once more at the end with `db:migrate`, `db:seed` and `seed:demo` alone. It holds the demo seed (`--seed 42 --week 9`) and nothing the suite left.
  - `lead_d_checks`, `lead_d_trace`, `lead_d_journeys`, `lead_d_race` and `lead_d_periods` were created for this review and dropped.
  - The statement logging was set on `lead_d_trace` only, reset after each count, and went with it. The probe's check constraint lived on `lead_d_trace` alone and was dropped by the probe.
- **Servers.** None is running, and ports 3000 and 3300 to 3302 are free.
  - I stopped my standalone servers and the worker by pid.
  - Playwright stopped its own server on 3000.
  - Only `college-dev-postgres-1` runs, and Testcontainers left no container.
- **Files my runs rewrote**, all gitignored:
  - `.next/`: `pnpm build`, with `.next/static` and `public` copied into `.next/standalone` as CI does; `check:types` regenerated `.next/types`;
  - `tsconfig.tsbuildinfo`;
  - `test-results/`, `playwright-report/` and `.local/e2e/*.json`, rewritten by the suite and then restored from copies taken first.
- **Throwaway scripts and outputs** live in the session's scratchpad, `/tmp/claude-0/-home-user/5e37ec44-7646-5dc2-a9c9-931742e652e2/scratchpad/ld/`:
  - the probes (`probes/`): sign-in, timing, statements, capture and replay, the two traces, the journeys, the race, the late joiner, the failing request, the deleted template, the board's links, drizzle's rendering, the periods' pass and the router's staleness;
  - the logs, the statement logs, `explain.sql` and its output, and the screenshots (`shots/`).
- **Repository.** Nothing in it changed except this report.

## Resolution (review/lead-D)

- The fixes are on `review/lead-D`, from `main` at `b90ad39` (Step 22, PR #60, squash-merged unchanged from the tree this review read). The `/lead-review` command asks for three things: fix every must-fix item; for each flow proposal the owner accepts, write an ADR and a note under its step before building it; and tag the section on `main` once the pull request merges.
- **The owner's choices, 23 October 2026.**
  - M4: the Done-when's 12 are a department's trainers, all of them («مدربو القسم كلهم»).
  - Proposal 2: the reach stays live, so someone who joins late is reached, even past the request's day («نعم حتى لو انضم متاخراً يصله»).
  - Proposals 4 and 5: build them («اختيار الكل بنقرة ويوم افتراضي», «تذكير من لوحة الجاهزية»).
  - Every logic error this review found: fix it without asking.
  - The rule for the fixes: each proven by a test that fails without it, and checked again by several agents.
- **The ADRs' numbers.** ADR-0031 went to the owner's request of the same day, a head's delegation of approvals (PR #61). Proposal 2's ADR is therefore ADR-0032, and proposal 5's is ADR-0033.

| Item | Disposition |
| --- | --- |
| M1: a held template offered for deletion | **Fixed as proposed.** `departmentTemplates()` computed `assigned` with a correlated subquery whose columns drizzle wrote without their table: `"template_id" = "id"` compared an assignment's template with the assignment's own id. So every template read as never assigned. The held templates are now read in a query of their own. The integration case reads a department's template as assigned while someone holds it, and not before or after, and fails without the fix. End to end, the inventory officer's card offers no delete. |
| M2: a failed pass asks the sender to send again | **Fixed as proposed.** `sendQuickRequest()` queues the request's pass in the request's own transaction, so no request is kept without one. The action runs that pass at once with `runNow()`, as the worker runs one, so `/system` and the console show it done or failed. A failed pass is recorded so and queued again for the worker, and the sender reads that the tasks come within the minute. A failed pass records the database's own words, not drizzle's wrapper with the statement and its values. The seed sends its requests through the same functions. |
| M3: one person told at a time | **Fixed from the pass.** The pass tells the people it gives or revives a task (`tellReached()`, `notifyEach()`). It takes two statements whatever their number, leaves out whoever turned the kind off, and tells each person once by the once key. The integration test counts the same statements for twelve people as for one. |
| M4: the Done-when timed on the robot | **Fixed with the owner's answer.** The keystroke-level model is in `e2e/support/model.ts`, shared with Step 19's run. Mechanical's head sends to its trainer role, all 13: 25.5 s by the model, under the 30, and the scripted run keeps a 30 s bound of its own. Electrical's trainers stay out of it, since the demo trainer's bell must read empty (Audit 4). |
| M5: links to refusals | **Fixed as proposed.** A row shows its link only where its page lets the viewer in, by the rule that page applies itself: `peopleScope()`, Rayat's key held anywhere, `planAccess()`, and `system.manage` for `/system`. Its owners are named either way. End to end, the dean's board links the term and the framework alone, and every link it shows opens. |
| The owner's item: ADR-0007 | **The decision stays the owner's; the four pages read again.** A link back reads a page again by itself, after about half a second. A step back or forward in the browser showed the page as drawn, with no request, however long since. This held both while Next.js kept it hidden and once it drew it from its cache, five pages on. The router hears such a step only from `popstate`, with a listener it adds first, and at the window Chromium runs the listeners in the order they were added. So the router shows the page before any later listener hears of the step. The Navigation API's `currententrychange` tells of it before the router does. `FreshOnReturn` hears the step from the Navigation API, or from `popstate` where a browser has none, and reads its page again once (`router.refresh()`). It does so whether it hears the step before the page shows or after, and also for a step to an earlier visit of a page that stays shown. The board, `/requests`, `/console` and `/system` carry it. End to end: each of the four shows a change made while away after a step back; the board also does so without the Navigation API, after going back past five pages, and after a step of two entries to an earlier visit of it; and a link back asks the server once. Each part was checked to fail without it, on builds with the part taken out: without the reading as a page shows, the five tests with the Navigation API fail; without the reading of the pages already shown, the three where the step is heard after the page shows. The three board tests reword one message and the suite runs fully parallel, so they now share a lock. Ten runs each on two workers had 12 overlapping pairs and one failure without it, and none of either with it. |
| Proposal 1 | **Built.** The matched row counts the trainers whose account is disabled beside those not on the platform, read alike: since the second verification, whoever holds a section's place from this week on, after the head's transfers (below). The matched row counts both and is done only when both are none. With only disabled accounts left, it leads to the people pages, which enable them. `/sections` marks such a trainer. The demo's board counts بدر المطيري's disabled account, and turns fully green only once the admin enables it. The owner's rule stays: the task waits for the account. |
| Proposal 2 | **The reach stays live** (ADR-0032, the owner's choice). Whoever joins a request's place later gets its task at the next pass, even past its day. The pass that makes or revives a task tells its person, once. The integration test tells a late joiner once, and gives a muted person the task without a notice. |
| Proposal 3 | **Built.** A new key, `plan.view`, opens a department's plan to read. The base seed and migration `0029` give it to the vice-dean, and the plan page and the board share one rule for it (`planAccess()`). End to end, the vice-dean follows a department's plan from the board. They read it with nothing that edits, publishes or starts a version. |
| Proposal 4 | **Built.** The sheet starts on this week's due day, or the next week's once it has passed (`nextDueDay()`). It is offered while such a day remains. «اختيار كل الظاهرين» ticks everyone the search shows, keeping those it hides ticked, and unticks them when all are ticked. Unit cases cover the days before, on and after a due day, before and after the term, a holiday on the due day, and a break. End to end, the head searches, ticks all shown, unticks some, and sends on the default day. |
| Proposal 5 | **Built** (ADR-0033). «ذكّرهم» on an open row reminds its owners, its sender aside, once a day each, with the kind `readinessReminder`, which opens the row's page. The row is read again on the server for the sender's reach. A reminder that reached anyone records `readiness.remind`. The console lists the open rows its viewer owns, in the board's words (`rowWords()`). Six mutations, each caught by the integration test: the sender left in, the day left out of the once key, the row's state and its term's closing unchecked, the event written for none, and the row read for the whole college. The permission matrix runs it for a plan's row and a college row. The demo's vice-dean reminded the admin of the matched row. |
| Proposal 6 | **Built.** `isWorkingDay()` is the rule. The service refuses a day off inside a counted week (`dueOff`), and the sheet's picker offers no day off and none outside the counted weeks. The integration case refuses a Friday, and fails without the service's check. |
| Proposal 7 | **Built.** A run is claimed only while no other run of its term is running, under an advisory lock on the term that the claim holds. A run left running for fifteen minutes no longer holds it. The integration test shows a pass waiting while another of its term runs. |
| Proposal 8 | **Built.** Each week of the assign sheet shows its days, as the transfer sheet's weeks do, and "from" starts on this week, "to" on the last. assignments.spec.ts picks weeks by their names and reads the default. |
| Smaller items | **Fixed:** a failed pass's row names whoever holds `system.manage` and links `/system`. `tasks.holder_id` restricts (migration `0030`): deleting an account that holds a task fails with `23001`, and the test fails with the old cascade. The `quickRequest` kind's hint names no role. `/texts?q=`: the search keeps the last search's items' words normalized for the next, 32.1 ms a query before and 8.2 ms after, with the same results in 180 searches over two lists of items in turn. **A note under Steps 23 and 26:** the `quickRequest` notice opens the task, not `/today`. The end-to-end fixtures delete a throwaway account's tasks before the account, since a pass may have given it some meanwhile: a throwaway spec showed the old teardown refused by `0030`. **docs/BACKLOG.md:** a request's settings read once, which saves about 4 ms of a 168 ms send, and the `announcement` kind's hint. |
| Earlier reviews' proposals | Unchanged in docs/BACKLOG.md, with this report's evidence beside them. |

### Second verification (24 October 2026)

Four agents attacked the resolution above by area: the request pipeline, the readiness board, the calendar and the request sheet, and data and the client. Each proved its findings with a test on the attacked tree, and a verifier then tried to refute each area's findings. The board's verifier confirmed all six of its findings. Every fix below is proven by a test that fails without it: the mutation checks are listed after the table.

| Finding | Severity | Disposition |
| --- | --- | --- |
| On the whole college's list, «اختيار كل الظاهرين» ticks someone who holds roles in two departments twice, and the schema's refusal reads «try again» | major | **Fixed.** A request names each person once in each department, as it reaches them (ADR-0030, decision 4): the schema's rule is per pair, and the integration case reaches one person in two departments once in each, and tells them once. A field the schema refuses now reads as such. A list over the 500 people one request may name is refused in the sheet, which offers everyone or a role instead. |
| A reminder of another term's row opens the recipient's own term, and never names it | major | **Fixed.** The notice carries its term, its words name it, and its link (`/switch-term/<id>?next=<page>`) chooses that term as the header does, for a viewer who may see it, then opens the row's page. Anything but a page of the platform opens Today. The notices list and the bell load such a link whole, so the header follows. End to end, Electrical's head opens a reminder of the next term's plan onto that plan, with the header naming the term. |
| The matched row ignores the head's transfers: done while a disabled account holds a section's work, open after a disabled trainer's sections were handed on | major | **Fixed.** The row counts whoever holds a section's place from this week on, after the transfers, as the engine and `/sections` read them (`trainersAhead()`). Rayat's own list of the trainers not on the platform is unchanged. |
| A head's board links a draft term's page, which refuses them | minor | **Fixed.** The term row links a draft only for whoever manages the college's terms (`rowOpens()`). |
| The dean reminds the owners of a draft term's rows, and the answers reveal the draft | minor | **Fixed.** A sender who does not prepare terms finds no row of a draft. |
| Before SS01 is applied, the matched row reminds the people managers and fills the admin's console | minor | **Fixed.** Until then it waits on, and names, whoever imports Rayat's reports. |
| A people manager without Rayat's key owns the trainers not on the platform, and their reminder links a page that refuses them | minor | **Fixed.** Those trainers are owned by whoever holds both keys, who sees them on Rayat's page and adds them there, or else by the admins. `holdersAcross()` takes the keys a row needs. |
| A database outage mid-pass reads «try again», and sending again doubles everyone's task | minor | **Fixed.** Once the request is kept, any later failure reads as pending and is logged. A pass left running is taken up by the worker after fifteen minutes. The integration case drops the database mid-pass and shows each task made once, and each person told once, after the takeover. |
| A request's pass that the worker runs and that fails is never queued again | minor | **Fixed.** Whoever runs it, a failed request's pass is recorded and queued again once, in one transaction (`generation_runs.retry`, migration `0031`). The retry waits for the worker's next round, a minute on. Other passes still wait for the next one, or for an admin (ADR-0029). |
| A holiday added on a request's day leaves its tasks due on it | minor | **Fixed.** A request is due on its day, or on the last day worked before it once a holiday or a break takes it, in that day's week (`workingDayBy()`). The notice of someone who joins after names that day. |
| The request sheet keeps the day it was first drawn with, which the server may refuse after midnight, a holiday or another term on view (not proven by the attack) | minor | **Fixed.** On opening, the sheet's day is the page's day now, unless the sender picked one still allowed (`openingDay()`). Its place and people are read from the page as it is now. |
| FreshOnReturn keeps a step its page never showed for, so a later link reads that page twice | minor | **Fixed** by the Navigation API's key for the entry, which the router's replace after a step keeps: a page that shows reads itself again for a step to the entry it shows on. A page already shown when it hears a step still answers by its address, as Next.js keeps it shown for a step to an earlier visit of it; the first fix matched it by key too, and the end-to-end test of the two-entry step caught it. The attack's own proposal, forgetting the step on any other change, was refused: the router's replace after a step back would clear it before the page reads itself, as a mutation of the unit test shows. |
| FreshOnReturn does not hear a page brought back from the browser's back-forward cache (not proven by the attack) | minor | **Fixed** with `pageshow`. Playwright starts Chromium with that cache turned off (`--disable-back-forward-cache`), so a unit test that plays the history proves it, not a browser. |
| The end-to-end teardown deletes a throwaway account's tasks and then the account, and a pass in between refuses the second | minor | **Fixed.** Its roles go first, so no later pass reaches it; then its tasks and the account, again while a pass already running gives it one more (`deleteAccounts()`). |

**Mutation checks.** Each part was taken out on its own, and its tests failed (the scratchpad's runner applies one change, runs its tests and restores the file):

- the request pipeline: no retry queued (3 tests), the retry unbounded, the retry run in the same round, a retry for every cause, the request's day as sent, the notice's day as sent;
- the board: transfers ignored, counting from the first week, the people managers owning a term without SS01, and owning the trainers not on the platform;
- the reminder's term: left out of the notice, out of its link, any term chosen, any origin opened, the link pushed rather than loaded;
- the client: a step kept by its address, no `pageshow`, the attack's proposal, a page already shown matched by its entry rather than its address, an unpicked day kept, a refused day kept, a refused field read as unexpected.

**Known limits.**

- While the database is away, a pass already claimed holds its term until the takeover after fifteen minutes, so a request sent then reaches its people later than the minute its sender reads.
- `/requests` lists a request's day as it was sent; its tasks show the day they are due.
- A browser without the Navigation API keeps a step by its address alone, so a link to the page it went to, before that page showed, reads it twice.
- The sheet's opening day is proven as a function; nothing tests the sheet itself kept open across a calendar change, since the unit project draws no DOM and changing the demo term's calendar mid-suite would move other specs' weeks.
