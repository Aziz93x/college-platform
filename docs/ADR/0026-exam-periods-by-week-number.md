# ADR-0026: Exam periods by week number, and due rules anchored to them

- Status: accepted (2026-10-23): the owner's notes of 21 October 2026, with the defaults stated to the owner for what the notes leave open; the owner may still change any of them
- Date: 2026-10-23
- Source: the owner's notes of 21 October 2026 under section 3 and Steps 13, 15, 19, 23 and 24 of docs/PLAN.md, and the design canvas «لوحة المدرب: تقويم الفصل بطبقاته»
- Changes: what Steps 13 and 15 built (an exam as a dated event of the calendar, and the rule "after each day of a kind")

## Context

The owner's notes ask for:

- exam periods set by week number, every term, of types from a catalog in data, seeded with four: the first periodic, the second periodic, the practical final and the theoretical final;
- a due rule anchored to the periods: before or after each period of the types it names, by so many weeks, on a weekday;
- deadlines that move with the periods when the vice-dean moves them;
- a period past the term's last week, or two in one week, as an error on the screen and at publish;
- the "open next term" wizard copying the periods as a draft.

Steps 13 and 15 merged before the notes. An exam is a dated event of the calendar, with a title of its own, and a rule counts so many weeks after each day of a kind, such as each exam. The questions put to the owner on 23 October about what the notes leave open went unanswered, so this change builds the defaults stated to them then. The canvas shows each period with its own from-week and to-week steppers, the two errors in its words, the head's choice of the period types a deadline is anchored to with before or after and a number of weeks, and the deadline on the Thursday of that week.

## Decision

1. **The types are a catalog in data**, `exam_period_types`: a code, a name and a short name, in order. The base seed gives each college the four of the canvas, by code, and never changes one it finds. No screen changes them yet.
2. **A term's periods are rows of their own**, `exam_periods`: a type, by its code, from a week to a week. A term has at most one period of a type. They are not dated events, because they are counted in weeks: the term's numbered weeks, past the holidays it skips.
   - The vice-dean sets them on the term's page, with a stepper for each first and last week, and saves them all at once (`saveExamPeriods()`, `examPeriods.update` in the log, with each changed period's weeks before and after, by its type's name).
   - A period past the term's last week, and two periods that share a week, are errors on the screen as the vice-dean steps (`periodProblems()`). A save with either is refused, naming the periods.
   - Shortening a term moves no period. A period the term then ends before shows its error, and the term is not activated until the vice-dean moves it (the activation is the calendar's publish).
   - The wizard copies the periods into the next term in the same weeks, past its end too: the vice-dean then moves them.
3. **The rule "after each day of a kind" gives way to the anchored rule**: `{ type: "examPeriods", periodTypes, side, weeks }`, before or after each period of the types it names, by 0 or more weeks.
   - Before a period counts from its first week, and after it from its last. A week before the term's first, or past its last, is not one of its tasks, as Audit 5 has it for every rule.
   - It is due on the week's last working day that is not a holiday, as every task is (ADR-0025): Thursday at this college, as the canvas shows. No rule names its own weekday yet.
   - A task keeps its occurrence, so a period moved moves its tasks not started, and never touches work started or finished. Saving the periods queues a pass of the engine (cause `periods`).
   - An item's services take only the college's types of period.
4. **The calendar's dated events keep their other kinds**: holidays, the grade deadline and events of the college's own. The kind `exam` goes.
5. **Migration `0022`**:
   - makes each exam event already there an event of the college's own, with its title and days. Its weeks cannot be read in SQL past the college's breaks, so it does not become a period: the vice-dean sets the term's periods.
   - makes each rule after a kind of day the rule after each exam period, naming the base seed's four types by the same weeks: exactly so for "after each exam", and the nearest rule for a kind of day no item has asked for.
   - `seed:demo` gives an active demo term without periods the canvas's four, so a demo made before this change takes them on its next run.

## Consequences

- The preview and the engine count a rule's weeks from the term's periods (`TermShape.periods`), and `eventWeeks()` goes.
- Step 19's department deadlines use the same rule and the same sheet. Its editor previews the weeks each anchored item lands in and flags one past the term's end (the owner's note under Step 19).
- Steps 23 and 24 draw the periods in the college's layer of the calendar.
- A weekday of a rule's own, a type of period a college adds, and the grade deadline anchored to the periods, which the canvas also shows, wait for the owner to ask for them.
