# ADR-0032: A quick request reaches whoever joins its place later, and the pass that reaches someone tells them

- Status: accepted (2026-10-24): the owner's answer of 23 October 2026 to lead review D's proposal 2, with the review's M2, M3 and proposal 7
- Date: 2026-10-24
- Source: docs/reviews/lead-D.md; ADR-0030, decisions 4 and 6; ADR-0025

## Context

ADR-0030 makes a quick request a source of its own, which every pass of the generation engine reconciles. Whom it reaches is therefore read again at each pass: everyone in its place, or a role's holders there, as `roleHolders()` gives them for the term. Someone who joins the department after the request was sent gets its task at the next pass, the nightly one at the latest.

Lead review D found three problems around that:

- **The late joiner was never told.** The notices went out from the action alone, to the people its own pass reached. A probe joined a department after a request due on 29 October; the pass of 1 November gave them its task, already due, and no notice.
- **A failed pass doubled the work (M2).** The action kept the request, then ran its pass outside `generation_runs`. When the pass failed, the sender read «حاول مرة أخرى». Sending again gave each person two tasks, and the first request's people were never told. Neither pass was recorded where `/system` and the console look.
- **The telling was one person at a time (M3)**: two statements each, 84 for the whole college's 42 people.

The review left the late joiner to the owner: fix whom a request reaches when it is sent, or keep the reach live and tell whoever it reaches. The owner answered on 23 October 2026: «نعم حتى لو انضم متاخراً يصله». It reaches them even if they join late.

## Decision

1. **The reach stays live.** This is the owner's answer.
   - A request to everyone in its place, or to a role's holders there, reaches whoever holds a role (or that role) there for the term at each pass, its sender aside.
   - Someone who joins after it was sent is reached by the next pass, even past its day.
   - A request to chosen people reaches exactly them.
   - Its day stays its day: a late joiner's task may already be due, and shows so.
2. **The pass tells.** Whoever a pass gives a request's task, made or revived, is told in that pass's own transaction (`tellReached()`).
   - Each person is told once for each request, by its once key, unless they turned such notices off.
   - The people reached when the request is sent and those reached later are told the same way.
   - No one is told of a task that is not there.
   - The notice gives the request's title, its day in the college's language and digits, and the sender's name.
   - It takes two statements per department changed, whatever the number of people (`notifyEach()`).
3. **A request's pass is a run** (M2).
   - `sendQuickRequest()` takes the function that queues the pass, and calls it in the request's own transaction. No request is kept without one.
   - The action runs that pass at once (`runNow()`), as the worker runs one, so it is recorded as done or failed.
   - A failed pass is recorded so, and queued again for the worker.
   - The sender reads that the tasks come within the minute, never "try again".
4. **One pass at a time per term** (proposal 7). A run is claimed only while no other run of its term is running. The claim holds an advisory lock on the term, so two claims never both pass the check. A run left running for fifteen minutes no longer holds its term.
5. **A failed pass records the database's own words**, not the statement drizzle wraps them in, which would carry its values to the system page.

## Consequences

- Decision 2 replaces ADR-0030's decision 6, by which the action told each person given a task. ADR-0030's decision 4, whom a request reaches, holds as decision 1 reads it.
- `/system`, the console and the readiness board's tasks row see every request's pass, and its failure.
- A late joiner's task due in the past is overdue at once. This is the second way a task arrives overdue, beside an assignment whose weeks are over (Audit 7's owner item).
- The demo seed sends its requests through the same functions as the action.
- Tests on a real database prove each decision, and each was checked to fail with its part taken out:
  - the pass queued with the request;
  - the failing pass, recorded, queued again and made good once;
  - the same statement count for twelve people as for one;
  - the late joiner told once, past the request's day;
  - a person who turned the notices off, given the task and not told;
  - a pass waiting while another of its term runs.
