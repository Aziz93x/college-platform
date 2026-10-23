# ADR-0025: The generation engine, built before the department plan

- Status: accepted (2026-10-22: the owner chose to build Step 20 in a second session while the first builds Step 18)
- Date: 2026-10-22
- Source: docs/PLAN.md, section 3 and Steps 17, 19 and 20; lead review C's note under Step 20 (the owner's rule)
- Changes: the plan's order (Step 20 before Steps 18 and 19), and Step 17's rule for a transfer's tasks

## Context

The plan builds one step at a time, in order. The owner runs two sessions side by side, and asked the second to build Step 20 while the first finishes lead review C and builds Step 18.

Step 20's inputs exist already:

- the term's calendar and weeks (Step 13);
- the framework's published versions and the counting function behind its preview (Step 15);
- Rayat's sections, their trainers and the transfers (Steps 16 and 17, lead review C).

The department plan (Step 19), assignments (Step 21) and quick requests (Step 22) do not exist yet.

Section 3 keys a task by "source item, occurrence, assignee and section". With the owner's rule, a section Rayat gives two trainers makes two tasks. Section 3 also asks that open work follow a transfer to the new trainer while completed work stays with whoever did it. Under that key, a transfer changes the assignee, so it would cancel a task and create another, and work in progress would be lost.

## Decision

1. **Step 20 comes before Steps 18 and 19.** The term's latest published framework is the engine's only source for now: `tasks.source` allows `framework` alone. Step 19 adds the plan as a second source, and Steps 21 and 22 add theirs. The Done-when's "and plan" is checked when plans exist.
2. **A task's key is its slot:** the term; the source and its item; the occurrence; the department; and either a section's place or a role's holder (`tasks_slot_unique`).
   - **The item** keeps its identity across versions. A framework item copied into a new version carries `origin_id`, the item it was copied from. Migration `0020` fills it for the versions already made, by position and title.
   - **A section's place** is each trainer Rayat names for the section at the term's start (`readTransfers().places`). The place's task goes to whoever holds the place in the task's week, or now, for a week already past. A trainer not on the platform holds a place too: the task keeps their employee number and waits for them, and goes to them with the next pass after they join, the nightly one at the latest.
   - **A role's holder** is the person: an item for a role makes one task for each holder in each department.
3. **Re-publishing follows section 3:**
   - a slot with no task gets one, and a cancelled task whose slot is called for again comes back;
   - a task not started takes the item's new words, week, due day, policy and assignee;
   - started work still to do (in progress, returned) changes only its assignee;
   - a task not started that no slot calls for is cancelled;
   - submitted, done and not applicable work is never touched.

   "No evidence" in section 3 reads as "not started": evidence only exists from Step 25, and a task with evidence is started. Each change checks the task's status again as it writes, so a trainer's change made while a pass runs is never overwritten.
4. **The preview equals generation by construction.** `dueWeeks()` gives the weeks a rule is due, from the same weeks and calendar the page reads (`eventWeeks()`). The preview counts them with `occurrences()`, and the engine generates them. The role holders the preview counts (`countMembers()`) are the rows the engine reads (`roleHolders()`). A property test checks that the two agree, on terms, rules, departments and sections that fast-check makes up.
5. **Every occurrence at once.** A recurring rule's tasks are all generated when the version is published, so the preview equals the tasks. The trainer's list shows them by week (Step 24).
6. **A task is due on its week's last working day that is not a holiday.** When holidays take every working day of a numbered week, which happens only with `calendar.skipHolidayWeeks` off, the task is due on the week's last working day.
7. **Passes run in the worker.**
   - The change that calls for a pass queues one after it is made: a version published, SS01 applied or rolled back, a transfer made or cancelled.
   - The worker runs the queued passes every minute, one at a time (pg-boss's `exclusive` policy). It takes each department in its own transaction and writes how far it has got. A pass left running for 15 minutes is taken over.
   - Each night it queues a pass over every term not yet closed. That pass reaches people who began or stopped holding a role, trainers who joined, and a transfer's earlier work still to do once the transfer is in effect.
   - A pass that changed something writes one `task.generate` event, by the system, with its cause and counts.
   - `/framework` shows the latest pass to whoever publishes the framework, and follows a pass while it waits or runs.
8. **Step 17's `transferTasks()` goes.** The place's holder replaces it, and "until week N" is not stored on a task: it is the transfer's week, which a later step reads from `section_transfers` where it shows completed work.

## Consequences

- Tasks exist before anyone can open them: Steps 23 and 24 build the trainer's list.
- Step 19 joins the engine rather than building its own:
  - plan items need an origin, as framework items have;
  - `tasks.source` gains `plan`, and `termInputs()` reads both sources;
  - publishing a plan queues a pass;
  - the plan's preview counts with `dueWeeks()`.
- A newer SS01 that names another trainer for a section, with no transfer made on the platform, gives the section a new place from the term's start. The old place's tasks not started are cancelled, as for an item dropped, and its started work stays with whoever started it. A trainer who changes mid-term is a transfer, which keeps the place.
- The anchored rule in the owner's note of 21 October 2026 (before or after each exam period of a type, on a weekday) changes only `dueWeeks()` and the due day.
- The demo term's 583 tasks take 0.3 s to generate, and a second pass changes nothing in about 40 ms. Step 20's budget is 10 s.
- `plan.publish`, which the owner's note of 22 October 2026 lists under Steps 19 and 20, is not checked yet. Step 19 checks it.
