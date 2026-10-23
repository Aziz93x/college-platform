# ADR-0027: Department plans, versioned, absorb the section templates

- Status: accepted (2026-10-23): the design stated to the owner when Step 19 started, which the owner left to these defaults
- Date: 2026-10-23
- Source: Step 19 of docs/PLAN.md, its notes from Steps 18 and 20 and from ADR-0026, and the owner's note of 21 October 2026 under it
- Changes: what Step 18 built (a department's section templates, kept apart from its plan, on `/templates`)

## Context

Step 19 asks for a plan per department and term, built on the framework, with drafts, a publication that makes a version that never changes, versions, and a copy from the previous term. Its items reach a person, a role, all trainers, each section's trainer or the secretary.

Step 18 built the section templates before the plan: a department's items for each section's or each course's trainer, kept as drafts "until the plan is published". Its note asks this step to take them into the plan's version when it publishes, to count them in its preview, and to decide whether `plan.edit` shows the next term while it is a draft. Step 20's note asks for an identity of each item across versions, the plan as the engine's second source, a pass queued by its publication, and `plan.publish` checked here.

## Decision

1. **One plan per department and term, version by version.** `plans` holds each version: a draft until its head publishes it, then never changed again. A department has one draft at most. `plan_items` holds each version's items in order, each knowing the item it copies as it was first entered (`origin_id`), as framework items do.
2. **The section templates are the plan's items.** There is one list, not two that publish together. Migration `0023` makes each department's templates for a term the items of a first draft of its plan, with their ids, order and fields, and `0024` drops `section_templates`. `/templates` gives way to `/plan`, and its audit actions stay in the list for the history they wrote.
3. **Whom an item reaches.** As a framework item does, or one person of the department:
   - each section's trainer, or each course's trainer once for all their sections of it;
   - the holders of a role in the department: all trainers, the secretary, or any role the admin adds;
   - one person, by account, while they hold a role in the department. Once they hold none, the item reaches no one, and the editor says so.
4. **Versions.**
   - Whoever holds `plan.edit` in the department fills the draft. Whoever holds `plan.publish` there publishes it. The base seed gives both to the head, and migration `0023` gives `plan.publish` to existing heads.
   - A change after publishing starts the next version from the latest published one.
   - A department's first version in a term starts empty, or from its plan in the previous term (the latest published version, or else the draft).
   - The Step 13 wizard copies each department's plan the same way, as a first draft of the next term.
5. **The engine reads each department's latest published plan beside the framework** (`publishedPlanItems()`). A plan's items reach their own department only. `tasks.source` gains `plan`. Publishing queues a pass, with the cause `plan`.
6. **The editor.**
   - On a wide screen, the plan by weeks: a row for each item and a column for each week, with the exam periods' weeks tinted. An item due in one week moves by dragging its mark along its row, or with the arrow keys. Items are chosen with their boxes and moved a week earlier or later, or taken out, together.
   - On a phone, a list by week: what recurs, then each week's items, then what lands in no week.
   - The framework's items for the department follow, locked.
   - The framework's sheet adds "save and add another". A saved item's toast names the weeks it lands in.
   - An item is flagged when a time of it falls outside the term's weeks, or when it reaches no one (the owner's note under Step 19).
7. **The publish preview** counts with `countTasks()` over the department alone: the tasks the draft makes. The review load is the tasks that ask for the head's approval, the draft's and the framework's in the department, over the term's weeks: "about N reviews a week".
8. **`plan.edit` shows the next term while it is a draft** (`preparesTerms()`), in the header and on every page that follows it, so a head prepares the plan the wizard copied before the term starts.

## Consequences

- Step 21's assignments become a source of their own, as Step 20's note says. A plan's item for a person or a role needs no assignment.
- Step 22's board reads whether each department's plan is published from `plans`. Its quick requests stay a source of their own.
- Step 24's department layer is the tasks whose source is `plan`.
- Step 29's sample includes the plan's tasks that ask for approval, which the review load already counts.
- A department whose head holds `plan.edit` without `plan.publish` prepares its plan, and someone who holds the key publishes it.
