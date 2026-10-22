# ADR-0022: A trainer Rayat names is added from its report

- Status: accepted (2026-10-22: the owner accepted lead review C's proposal 2)
- Date: 2026-10-22
- Source: docs/reviews/lead-C.md, proposal 2 and journey 4b; docs/PLAN.md, section 1 and Step 17

## Context

The SS01 card on `/rayat` lists the trainers SS01 names who are not on the platform, such as "209001: الشعبة 30111". It tells the reader to add them "في صفحة المنسوبين بالرقم الذي يكتبه رايات". Only `people.manage` adds people, so an importer without it can only pass the number on.

The admin's path takes 3 views, 12 taps and 3 fields: `/rayat`, then `/people`, then `/people/new`. There the admin types the number, the name and the email, and chooses the role and the department.

The number is typed again. A mistyped number leaves the section unmatched, against section 1's metric: "SS01 sections matched to their trainer: 100%".

## Decision

1. **Each line links to adding the trainer**, for whoever holds `people.manage`. The link opens `/people/new` with these filled in:
   - the employee number;
   - the department of the first section the line names;
   - the role that completes tasks. That is the college's one role, other than the system's, that holds `task.complete`. The role is left empty when no role or several roles hold it.
2. **`/people/new` takes them from its address.** It fills only a department that is active, a role it offers, and a number that passes the form's own check. The admin types the name and the email and adds the person as before, through the same action and its checks.
3. **Others read the line as before.**

## Consequences

- Journey 4b takes 2 views, about 6 taps and 2 fields, and the employee number is never typed again.
- The person is added through the people import's action, so the same audit event, temporary password and role rules hold.
