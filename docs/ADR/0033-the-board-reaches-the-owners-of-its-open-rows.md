# ADR-0033: The readiness board reaches the owners of its open rows

- Status: accepted (2026-10-24): the owner accepted lead review D's proposal 5 on 23 October 2026 («تذكير من لوحة الجاهزية»)
- Date: 2026-10-24
- Source: docs/reviews/lead-D.md, proposal 5 and journeys 4a and 4b; ADR-0030, decision 5; ADR-0029

## Context

ADR-0030 gives the vice-dean, the dean and each head the term readiness board. Each row names whom it waits on and the page that settles it.

The board could not reach those people. In journey 4a, the vice-dean found the open row «مطابقة مدربي رايات … يتولاه هند القحطاني» in 3 taps. Its page, `/rayat`, says that whoever manages people adds the trainer. Neither page could tell the admin. The admin's own path (4b) took 4 views and 9 taps, once she knew.

## Decision

1. **Whoever sees an open row may remind its owners.**
   - Only the row's owners are reminded, its sender aside, and only while the row is open and its term not closed.
   - The board shows «ذكّرهم» on such a row.
   - Seeing the row is the action's check: `readiness.view` in the plan's department or across the college. For the college's rows, it is `readiness.view` wherever the viewer holds it, as the board shows them to a head.
   - The row is read again on the server, as the board reads it for the sender (`remindOwners()`). A row the sender no longer sees is "not found". A row settled since is "not open". A row only the sender owns has "no one" else to remind.
2. **Once a day, with a kind of its own.**
   - Each owner is reminded of a row at most once a day on the college's clock, by the notice's once key `readiness:<term>:<row>:<day>`. Someone else's reminder the same day reaches no one, and its sender reads so.
   - The kind is `readinessReminder`. A person may turn it off in their preferences, as every reminder may be turned off.
   - The notice names the row as the board did when it was sent, its sender and what it waits on. It opens the row's page, which its params carry. It is the first kind whose page is not fixed (`notificationPage()`).
   - A reminder that reached anyone records `readiness.remind` on the term, with the row's title and how many it reached. One that reached no one records nothing.
3. **The console lists the viewer's open rows.** For the term on view, unless it is closed, the console's «ما يحتاج إليك» lists each open row the viewer owns, in the board's words. Each links to the row's page, where the viewer opens it, by the rule the board applies (`rowOpens()`).
4. **The words are the board's.** The board, the console, a reminder and the demo seed name a row through one function, `rowWords()`, from the catalog.

## Consequences

- Journey 4a becomes 4 taps: the board, the row's «ذكّرهم». The admin's bell opens `/rayat`, and the console lists the row.
- Step 27 decides how reminders are worded together; this kind joins them.
- The demo's vice-dean reminded the admin of the matched row on seeding.
- Tests on a real database prove each rule, and each was checked to fail with its part taken out:
  - the sender left out;
  - the day in the once key;
  - the row's state, and its term closed;
  - the event only for a reminder that reached someone;
  - the row read for the sender's reach.
- The permission matrix runs the action for every seeded role, across the college and in a department, for a plan's row and a college row.
