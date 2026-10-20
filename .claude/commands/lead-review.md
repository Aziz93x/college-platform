---
description: Lead engineer review at the end of a plan section
argument-hint: <section letter>
---
1. From an up-to-date main, create branch review/lead-$ARGUMENTS.
2. Use the lead-engineer agent to review section $ARGUMENTS.
3. Fix every must-fix item.
4. For each flow proposal I accept, write an ADR and add a note to the affected step in docs/PLAN.md
   before implementing it.
5. Open a PR titled "lead: section $ARGUMENTS"; squash-merge it when CI is green, then tag the section
   release on main.
