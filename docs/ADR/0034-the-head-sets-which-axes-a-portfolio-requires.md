# ADR-0034: The head sets which axes a portfolio requires

- Status: accepted (2026-10-24): the owner's answer of 24 October 2026. Built with Steps 31, 30, 32 and 33
- Date: 2026-10-24
- Source: the owner's answer of 24 October 2026, asked what a portfolio shows of an exam copy whose sample was not uploaded (ADR-0031, answer 13); docs/PLAN.md, section 3 (portfolios) and Steps 14, 30, 31, 32 and 33

## Context

A portfolio is a view of the trainer's work by axis: the administration's 11 axes in 3 groups, and the closing group, which the plan calls optional and nothing marks so yet (Step 14, and its note under Step 31). The axes are the administration's: their codes, titles and order change only on the admins' catalog.

The owner wants the portfolio to show complete by the axes they adopted: «الاساس عندي هو ملف الانجاز، لابد ان يظهر كامل حسب المحاور التي اعتمدناها». Asked whether an exam copy with no sample shows as missing in it, they answered:

> «رئيس القسم يحدد المحاور الإلزامية والاختيارية، واذا كانت الزامية ولم يتم الرفع فتظهر فارغة أما اذا كانت اختيارية ولم يتم الرفع فلا تظهر وتكن مخفية عن ملف الانجاز»

The head sets which axes are required and which optional. A required axis with nothing uploaded shows empty; an optional one with nothing uploaded does not show, hidden from the portfolio.

## Decision

1. **The head marks each axis required or optional, for the department's portfolios.** The catalog stays the admins'. Which of its axes a department requires is the head's, with a key that no delegation holds, as the department portfolio's freeze date is (ADR-0031, decision 8).
2. **A required axis always shows.** Its items show with what was uploaded, and an item with nothing uploaded shows empty and counts among what the portfolio is missing.
3. **An optional axis shows only what was uploaded to it.** An item with nothing uploaded is left out, and an axis with nothing at all is left out of the portfolio, its PDFs and the department portfolio. Nothing of it counts as missing.
4. **An exam copy's place is its sample** (ADR-0031, decision 6). An approved copy with no sample has nothing uploaded for the portfolio: under a required axis it shows empty, under an optional one it is left out.
5. **Until the head marks them,** every axis is required but the closing group's, which is optional, as the plan has it.
6. **A frozen version keeps what it froze.** A change of the head's marks changes the portfolios as they show from then on, never a version already approved.

## Consequences

- **Step 31 builds the marks** and the portfolio view that follows them: required axes in full, optional ones only where something was uploaded, readiness per axis by its marks. The marker the note from Step 14 asks for is this one.
- **Step 30** counts what is missing in the required axes only, in the trainer-by-axis grid and in what the head approves.
- **Steps 32 and 33** leave an optional axis with nothing in it out of every PDF and of the department portfolio, and list as missing only what a required axis lacks.
- **Each step's tests** cover a required axis with an empty item, an optional axis left out, a change of marks that leaves an approved version as it was, and the copy's sample under each.
- **The demo** marks one axis optional in one department, besides the closing group.
- **The privacy record** gains nothing: the marks are the department's, about no person.
- **Not taken:** marks for each item rather than each axis. The owner named the axes.
