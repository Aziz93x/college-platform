# ADR-0020: A transfer in conflict with Rayat reaches the head

- Status: accepted (2026-10-22: the owner accepted lead review C's proposal 3)
- Date: 2026-10-22
- Source: docs/reviews/lead-C.md, proposal 3 and journey 5b; docs/PLAN.md, Step 17
- Builds on: Step 17's transfers, and lead review C's M2, which settles what each state of a transfer means

## Context

Step 17 asks that "conflicts with a newer SS01 [be] flagged for review". It flags them on the card of the section, among a department's cards, on a page a phone keeps under "المزيد".

- The vice-dean applies a new SS01 without seeing which heads' transfers it confirms or breaks. Its diff says only "تغيّر المدربون: الشعبة 30112".
- After the apply, nothing tells the head. They learn of a conflict only if they open `/sections` and scroll to it.
- The demo has no conflict, so a reviewer never sees one.

After lead review C's M2, a transfer reads one of four ways against the SS01 in force:

- **holds:** Rayat's file was uploaded before the transfer, so it cannot know of it yet;
- **confirmed:** Rayat names the new trainer and no longer the one replaced;
- **in conflict:** a file uploaded after the transfer still names the trainer it replaced;
- **another trainer:** Rayat no longer names the trainer the transfer replaced, so it changes nothing.

The last two need the head.

## Decision

1. **The pending SS01 names the transfers it changes.** Its card on `/rayat` lists each transfer whose state applying it would change, with its section, its trainers and the state it would take. The vice-dean sees whose transfers the file confirms or puts in conflict before applying it.
2. **Applying or rolling back SS01 tells the heads.** When a version of SS01 comes into force, applied or rolled back to, each transfer it newly puts in conflict, or leaves replacing a trainer Rayat no longer names, tells the holders of `sections.transfer` in its department.
   - A notification of its own kind, `transferConflict`, names the section and opens `/sections`.
   - People may turn the kind off, as the other kinds of the platform except announcements.
3. **`/sections` puts first the sections that need the head**: those with a transfer in conflict or replacing a trainer Rayat no longer names, before the department's other sections.
4. **The demo shows one.** `seed:demo` makes one transfer that a newer SS01 then puts in conflict, and the head of Electrical gets its notification.

## Consequences

- The Rayat page reads the term's transfers and each section's trainers in the pending SS01; it shows only the transfers whose state would change.
- The academics module tells the heads, because the Rayat module may not depend on it: the Rayat actions call it after an apply or a rollback of SS01, and so does `seed:demo`.
- The notification kind has its words under `notifications.kinds.transferConflict`, a row in each person's preferences, and a place in the weekly digest like any other kind.
