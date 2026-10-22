# ADR-0021: The sections page for whoever imports SS01, one department at a time

- Status: accepted (2026-10-22: the owner accepted lead review C's proposal 5)
- Date: 2026-10-22
- Source: docs/reviews/lead-C.md, proposal 5 and journey 5a; docs/PLAN.md, section 1 and Step 17

## Context

`/sections` opens only for `sections.transfer`, the heads' key, and the admin's across the college.

- The vice-dean imports SS01 and is refused the page that shows what the file made. Section 1 gives the vice-dean "every department down to trainer, section …, read only".
- Whoever holds the key across the college gets every section of the college on one page. At 720 sections that is 3.9 MB and a p95 of 523 ms, over section 4's 300 ms.
- A head of a 60-section department scrolls 60 cards on a phone to find one.

## Decision

1. **Importers read the sections.** `/sections` opens for whoever holds `rayat.import`, held anywhere as ADR-0019 has it, as well as for `sections.transfer`.
   - An importer reads every department's sections.
   - The controls that transfer, keep and cancel stay with `sections.transfer`, in the departments where it is held.
   - The navigation shows the page for either key.
2. **One department at a time.** A viewer who reaches more than one department sees one, chosen at the top of the page. The address keeps the choice (`?department=`), and the first department in the college's order is shown when there is none.
3. **A search box** filters the department's sections by reference, course code or name, and trainer name or employee number. The address keeps it too (`?q=`).

## Consequences

- The page reads one department's sections, transfers and transfer candidates, whatever the college's size.
- A head of one department sees no department list.
- The search filters on the server, so a link to a search opens the same sections.
