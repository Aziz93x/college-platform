# BeUI components and where each one is used

The owner chose these BeUI components (beui.dev, source `starc007/ui-components`, MIT) for the
platform: motion is part of its identity (docs/PLAN.md section 4, owner direction at Step 5). Each
one is adopted in the step that builds the screen it serves, never before: a component enters the
code with its first real use and a test of that use.

## How a component is adopted

1. Copy it from a pinned commit of `starc007/ui-components` into `src/components/motion/` and
   record the source, the commit and every local change in `src/components/motion/PROVENANCE.md`.
2. Words come from `messages/*.json`; the English defaults become required props.
3. Right to left: logical properties (`start`, `end`, `ms`, `ps`, `text-start`), mirrored icons
   and motion that moves toward the reading direction's end.
4. This design system's scales: the identity colors through the role tokens, the small radius
   scale, `shadow-xs` to `shadow-lg`, Regular and Medium only, no letter spacing on Arabic.
5. Motion through `m` elements under `MotionProvider` (features load after the first paint) and
   `useReducedMotion` for movement; touch targets of 44 px; axe without serious issues.
6. An end-to-end test of the real use, on the desktop and the phone projects.

## Adopted in Step 5 (the app shell)

| Component | Real use |
| --- | --- |
| Blocks: command palette | Ctrl or ⌘ K and the header's search: the pages the viewer may open |
| Motion: dock | The phone's floating tab bar, with the gliding current-page pill |
| Motion: shared-layout-bg | The desktop sidebar: the pill that follows the pointer and the keyboard |
| Motion: bottom sheet | The phone's "More" sheet, beyond five pages (and the design catalog) |

## The rest, by the step that first uses each one

| Step | Component | Real use |
| --- | --- | --- |
| 6 | Motion: input | Employee number or email and password on the login page: label, stable error row, error shake |
| 6 | Motion: checkbox | "Remember this device" |
| 6 | Motion: alert | Sign-in errors and the lockout (announced at once), and the pilot banner (announced politely) |
| 6 | Motion: loader | The sign-in button while it signs in |
| 6 | Motion: text animation (reveal) | The platform and college names over the login page's identity art |
| 6 | Blocks: bloom menu | The avatar menu in the header: profile, change password, sign out |
| 7 | Motion: switch | Yes-or-no settings: Hijri display, logo on the login page, email delivery |
| 7 | Motion: select | Choice settings: language, first day of the week, digits |
| 7 | Motion: range slider | Percentages: the review sample rate |
| 7 | Motion: adaptive stepper | Bounded counts: lockout threshold, remembered-device days, weekly review cap |
| 7 | Motion: popover | Each setting's description, from a help control beside its label |
| 7 | Motion: tabs | The settings groups |
| 7 | Motion: action swap | "Save" that turns into "Saved"; "Reset to default" |
| 8 | Motion: table | Departments, then people (10), sections (17) and the audit log (11): sorting, selection, a sticky header, virtualized rows |
| 8 | Motion: breadcrumb | The page header's trail from the first page below another (Departments › a department) |
| 8 | Motion: animated badge | A department's active or inactive state; later account (10), readiness (22) and task (26) states |
| 9 | Motion: combobox | Choosing the person for a membership; later the trainer of a section (17) |
| 10 | Blocks: overflow actions | A person's row: reset the password, lock, disable |
| 11 | Motion: date range picker | The audit log's period filter; then holidays and exam weeks (13) |
| 11 | Motion: collapsible | An audit event's diff, and the history panel on entity pages |
| 11 | Motion: animated sidebar | The desktop sidebar once it has its administration group (settings, departments, roles, people, audit log): nested groups and the icon rail; the Step 5 list and its shared-layout pill move into it |
| 12 | Blocks: notification stack | The bell's notification center |
| 13 | Motion: adaptive stepper | The number of weeks in a term |
| 13 | Motion: select (morph) | The header's term switcher |
| 21 | Motion: multi select | An assignment's trainers; then a quick request's chosen people (22) and the kinds that require approval (29) |
| 22 | Motion: expandable control | The quick-request button, which opens into its label; then the head's one-tap reminder on Today (23) |
| 23 | Motion: pull to refresh | Today on a phone, for trainers and heads |
| 24 | Motion: tabs | My work's filters (this week, overdue, plan, sections, assignments), kept in the URL |
| 24 | Blocks: morphing tabs | The section page's rooms: tasks by week, then indicators (35) |
| 24 | Motion: preview rail | My work's weeks of the term, with a preview of each week's tasks |
| 25 | Blocks: project folder | A task's evidence files, fanned out and opened as a set |
| 25 | Motion: loader | Upload progress, retry and resume |
| 26 | Motion: action swap | "Done" on the task card, accepted at once while uploads finish |
| 26 | Blocks: overflow actions | The card's other actions: not applicable with a reason, "I have a problem" |
| 29 | Blocks: expandable action bar | The review card's decisions: approve, return with a note, undo |
| 31 | Motion: bouncy accordion | The portfolio's 11 axes in three groups, one open at a time |
| 32 | Motion: text animation (shimmer) | "Preparing the PDF" while the worker renders it |

Not listed by the owner but fitting: BeUI's one-time-code input for the admins' two-factor code
(Step 6), and its number ticker for "portfolio: 12 of 40" on Today (Step 23). Each joins only if
its step finds it better than the plain primitive.
