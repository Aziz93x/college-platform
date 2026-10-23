# ADR-0030: Quick requests as a source of their own, and the term readiness board

- Status: accepted (2026-10-23): the owner's answers to three questions
- Date: 2026-10-23
- Source: docs/PLAN.md Step 22 and its notes from Steps 5, 12, 19 and 20, Audit 7 and ADR-0029; ADR-0025 (the generation engine); the owner's answers of 23 October 2026

## Context

Step 22 asks for two things.

- **Quick requests:** urgent work sent without the plan editor. The step says its tasks are "created at once and recorded as ad-hoc plan items". Step 20's note (ADR-0025) says they are created by `generateTerm()` in the request, "with the quick request as a source of its own".
- **A readiness board:** each responsibility of a term with its owner and its page, for the vice-dean, the dean and the heads.

Three questions were the owner's, and they answered them on 23 October 2026:

1. **The axis:** every task counts under a portfolio axis. The sender picks it.
2. **Who sends, and to whom:** a head sends to their department; the vice-dean and the dean send to one department or to the whole college.
3. **The board's reach:** a head sees their department only, beside the college's rows; the vice-dean and the dean see every department.

## Decision

1. **A quick request is a source of the generation engine of its own** (`quick_requests`, the source `request`), not an item of a department's plan.
   - A plan has versions, a draft and a publisher in its department. A request has none of these, may go to the whole college, and has its own day.
   - As a source, the engine reconciles it as it does the framework's, the plans' and the assignments' items. A pass makes its tasks once, and changes nothing that is finished.
2. **What a request is:**
   - its words, the axis its tasks count under, and the day they are due;
   - whom it reaches: everyone in its place but its sender, the holders of one role there, or people chosen there, each in their own department;
   - whether it asks for evidence.

   Its evidence policy is fixed when it is sent: the college's accepted types, one file, and no approval, as a quick upload. Its tasks are of the general kind.
3. **Its day:** one day the sender picks, in a counted week of the term, not before today on the college's clock. Its tasks fall in the week that holds that day.
4. **Whom it reaches:** those who hold a role in the place for the term (`roleHolders()`, Audit 7). A draft next term reaches its own people. A request to the whole college reaches each person once in each department where they hold a role.
5. **The key `requests.send`:** held in a department, it sends to that department; held across the college, to one department or the whole college. The default roles of the head, the vice-dean and the dean hold it (migration `0028`).
6. **Sending:** the action keeps the request and records `quickRequest.send`. It then generates the term's tasks at once, with the cause `request` and no queued pass. Finally it tells each person given a task, once, unless they turned such notices off: the kind `quickRequest`, with the title, the day in words and the sender.
7. **The board** (`readiness.view`) reads, for the term on view:
   - the term active;
   - the framework published;
   - someone in each active department who completes tasks this term;
   - Rayat's SS01 and SF01 applied (SO01 a college may leave out);
   - every trainer SS01 names on the platform;
   - the latest pass of the generation engine done (at work while it waits or runs);
   - each active department's plan published.

   Each row names whom it waits on: those who hold its key across the college, or a department's own holders for its plan. Where no one holds the key that way, the admins are named; they settle it or give the role that does. Held in a department, the key shows the college's rows and that department's plan; held across the college, every department's (the owner's answer).
8. **The quick request's button opens a sheet**, as every new thing in the app does: the item sheet, the assign sheet. No expandable control was vendored (Step 5's note), and a second pattern for the same act would break the screens' consistency (UX review 2). Chosen people are ticked under the search field, as Step 21's assign sheet does (Audit 7).

## Consequences

- A request's tasks appear on the sender's next page, and its people are told at once, without waiting for the worker. Sending takes as long as one pass over the term.
- The plan's versions hold only what the department planned. A request stays out of a plan's preview and its counts.
- The board's facts are read when it is opened; nothing is stored for it. Step 28 adds the trainers' profiles as a row; Step 23 brings the board to the vice-dean's and the dean's Today and the button to the head's.
- Migration `0028`: `quick_requests`, the source and the cause `request`, and the keys for the default roles.
