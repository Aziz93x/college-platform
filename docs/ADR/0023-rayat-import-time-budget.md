# ADR-0023: A measured time budget for Rayat's imports

- Status: accepted (2026-10-22: the owner chose lead review C's proposal 9, the measured budget)
- Date: 2026-10-22
- Source: docs/reviews/lead-C.md, proposal 9; docs/PLAN.md, section 4 and Step 16
- Extends: ADR-0010's measured budgets

## Context

Section 4 gives a write 1 s at p95. A Rayat upload reads the whole file, checks every row, diffs it against the version in force and keeps its records, in one transaction under the college's lock.

- The demo's SF01, 767 rows, takes 256 to 281 ms through the page.
- A college-sized SF01 of 21,000 rows (1.56 MB) takes about 3.4 s:
  - reading the XLSX: 677 ms;
  - checks: about 70 ms;
  - the diff: 14 ms;
  - inserting the records: 1.1 to 1.2 s.

An upload happens a few times a term, in the add and drop weeks. Section 2 lists imports among the worker's jobs, but a job with progress costs 3 to 4 hours. The owner chose a budget that says what an import may take, and measures it.

## Decision

1. **Section 4 gains a row for Rayat imports.** Uploading a report takes at most 5 s for 25,000 rows, from the file's bytes to its import kept with its diff. Applying or rolling it back is a write like any other.
2. **A test measures it.** An integration test builds an SF01 of 25,000 rows as an XLSX file, reads it with `readTable()` and uploads it through `uploadRayat()`, and fails past 5 s.
3. **The import stays in the request.** Moving it to the worker remains the way out if a college's files outgrow the budget.

## Consequences

- The college's lock is held for up to about 4 s during a large upload. Term, framework, transfer and department changes wait that long, a few times a term.
- If the test fails on CI's runner, the insert is made faster, not the budget looser. The first step is one `unnest` statement for each chunk of records, which saves about 15%.

## Amendment (22 October 2026): measured alone

The test ran beside every other test file, and on CI it once took 5.5 s, on PR #50's run. On a two-core workspace with three workers, it took 3.7 and 4.2 s beside the others and 3.0 and 3.2 s alone. It now runs in its own Vitest project, `budget` (`tests/budget/`): after the unit and integration projects, one file at a time, on a PostgreSQL of its own (`vitest.config.mts`). Each run notes its time, which GitHub shows beside the run: 2.4 s on CI's runner, on #51's first run. The budget and decision 2 are unchanged, and so is the consequence above, for a test that fails alone.
