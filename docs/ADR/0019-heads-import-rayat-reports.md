# ADR-0019: Heads of department import Rayat's reports too

- Status: accepted (2026-10-22: the owner asked for it while Step 16 was in review)
- Date: 2026-10-22
- Source: the owner's request; docs/PLAN.md, section 1 and Step 16
- Builds on: Step 16's Rayat import

## Context

The owner asked, while Step 16 was in review: «في اضافة تقارير رايات ايضا ممكن رئيس القسم يقوم بالمهمة .. ولابد ان يتم توضيح اسم من رفع التقارير مثل اخر تحديث وهكذا واسم اللي رفع الملف». In other words, a head of department may also import Rayat's reports. And the page must say who uploaded each file, and when each report was last updated.

Asked whether a head's file covers their department only or the whole college, the owner answered: the whole college (الكلية كلها), as the vice-dean uploads it.

The plan gave Rayat's uploads to the vice-dean alone (section 1), and Step 16 checked `rayat.import` held across the college. A head holds their keys in their department.

## Decision

1. **A head imports the college's reports.**
   - `rayat.import` held in a department lets its holder do what it lets its holder across the college do: upload, apply, discard and roll back the reports of the term on view.
   - A file is the whole college's, and applying it replaces the version in force for every department.
   - The page and the actions check that the key is held somewhere (`permittedDepartments()`), not that it is held across the college.
2. **The head's role holds the key by default.**
   - The base seed gives `rayat.import` to the head as it does to the vice-dean, and admins change it on the roles grid.
   - A college seeded before this keeps its grid, and its admin gives the key there, as ADR-0017 did for announcements.
3. **The page names who did what, and when.** For each report's version in force, it shows when it was last updated (applied), who uploaded its file and, when someone else applied it, who applied it. An upload waiting to be applied names who uploaded it and when, and so does each earlier version. The audit log already records each upload, apply, discard and rollback with its actor.
4. **Not now:**
   - A head's file limited to their department, with a version for each department. The owner chose the whole college.
   - Telling the vice-dean when a head applies a version. The page and the log show it.

## Consequences

- A head and the vice-dean can each replace the other's version. The page shows who did it, the log keeps the history, and either of them can roll back the version in force.
- The permission matrix allows the Rayat actions to the key held in a department, and the actions check it themselves rather than through their metadata, which requires the key across the college.
- `seed:demo`: the head of Electrical uploads SO01, which the vice-dean applies, and the newer SF01 that waits for review. The page then shows both names, and an applier beside an uploader.
