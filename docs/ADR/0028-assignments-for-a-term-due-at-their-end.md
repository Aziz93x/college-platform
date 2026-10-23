# ADR-0028: Assignments, given for a term and due at their end, from templates shared or a department's own

- Status: accepted (2026-10-23): the owner's answers to three questions when Step 21 started
- Date: 2026-10-23
- Source: Step 21 of docs/PLAN.md and its notes from Steps 5, 10, 19 and 20 (ADR-0025, ADR-0027); today's app (`assignmentDefaults` in `lib/business-domain.ts` of department-work-tracker-next)

## Context

Step 21 lets heads give trainers responsibilities beside their teaching, each with its own tasks:

- the templates are data: the six of today's app are seeded, and heads add more;
- a head assigns a template to one or more trainers for a term or a date range, and its tasks go under the template's axis (seeded: axis 9);
- a template may grant a role, and by default only the secretary's does.

Its Done-when: assigning the secretary template grants the secretary's permissions, revoking it removes them, and the template's tasks exist for the assignee.

Today's app gives every task of an assignment to its one person, with one due date. It encourages evidence and does not require it. The plan left three things open, and the owner answered them on 23 October 2026:

1. **When the tasks are due: once, at the assignment's end.** One task per template item for each assignee, due in the last week of the term or of the chosen range.
2. **How far an assignment reaches: one term, with the grant for the term.** An assignment belongs to one term: the whole of it, or a range of its weeks. The secretary's grant holds for that term until the head revokes it.
3. **Who owns the six: they are shared.** Every head assigns them and none changes them. Heads add their own for their department.

## Decision

1. **Templates.**
   - `assignment_templates`: a template without a department is shared. The six come from the base seed, by their keys.
   - A department's own template is added by its head, who renames it and removes it while it is not assigned.
   - Each template names the axis its tasks go under; the six use axis 9, "التكليفات".
   - A template may name a role it grants. Only the seed sets one: the secretary's grants `secretary`.
   - `assignment_template_items` holds a template's items in order: their title, kind and evidence, as a plan's item has them. Their axis is the template's, and they are due at the assignment's end.
   - The six ask for evidence that is welcome but not required, of every type the college accepts, as today's app does.
2. **Assignments.**
   - `assignments`: a template given to one person of a department for one term, the whole term or from a week to a week of it.
   - A person holds a template once in a department and term.
   - Revoking deletes the row, and the audit log keeps the history.
3. **The grant.**
   - Assigning a template that grants a role adds a membership of that role in the department for the assignment's term (`memberships.term_id`), with its event and notification. The assignment keeps the membership's id.
   - Revoking removes that membership, in the same transaction.
   - Someone who already held the role there for the term keeps it: the assignment adds nothing, and its revocation removes nothing.
   - The keys are the role's, which the admin sets on the roles grid. A head gives the role, not keys of their own choosing, in their own department and for one term.
4. **The key.** `assignment.manage`, held in a department, covers assigning and revoking there and keeping the department's own templates. The base seed gives it to the head, and migration `0026` gives it to existing heads.
5. **The engine.** An assignment is a source of its own: `tasks.source` and the cause of a pass gain `assignment`.
   - Each item of an assignment reaches its person in its department, as a plan's item for a person does, while they hold a role there.
   - The task is due once, in the assignment's last week, or else the term's, and never past the term's end (`dueWeekOf()`).
   - A task's key is the template's item and the person. Assigning the same template to the same person again in the term finds the same tasks.
   - Assigning, revoking, and changing a template's items or axis queue a pass.

## Consequences

- A role the admin later gives keys reaches its current assignees at once: Step 33's secretary screens give the secretary's role its keys, and the assignment's holder has them for the term.
- Step 24's work list shows the tasks whose source is `assignment`, under their axis.
- A change to a template's words reaches its tasks not yet started, as a plan's new version does. Finished work keeps the words it was done under.
- The demo makes each department's secretary by assignment instead of a membership (Step 10's note).
- A department's own template outlives the term: the next term's head assigns it again. Assignments are not copied into the next term.
