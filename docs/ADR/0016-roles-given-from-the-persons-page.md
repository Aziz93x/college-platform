# ADR-0016: Roles given from the person's page

- Status: accepted (2026-10-22: the owner accepted lead review B's proposal 6)
- Date: 2026-10-22
- Source: docs/reviews/lead-B.md, proposal 6 and journey 4; docs/PLAN.md, Steps 9 and 10

## Context

A person's page lists their roles, and roles are given from each role's page. To make a trainer the head of a department (journey 4), the admin leaves the person and goes through these steps:

1. Open the Roles tab.
2. Open the role.
3. Type the person's name and choose them.
4. Choose the scope.
5. Add.

That is 7 taps, a typed name and 2 pages, often right after adding the person on `/people/new`.

## Decision

1. **A person's page gives them a role**, across the college or in one active department, to whoever holds `roles.manage`.
   - It goes through the same action as a role's page (`addMembershipAction`), with the same key and the same password step.
   - It writes the same `membership.create` event and sends the same `membershipAdded` notification.
   - The system role is given across the college only, as on its own page.
2. **Taking a role away stays on the role's page.** There, a sheet confirms it and the last admin who can sign in keeps theirs.

## Consequences

- Journey 4 takes 5 taps and no typed name, on the page the admin is already on.
- The person page reads the college's roles and active departments for whoever holds `roles.manage`.
