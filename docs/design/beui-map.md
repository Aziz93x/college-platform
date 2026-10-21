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

## Adopted in Step 6 (sign-in)

| Component | Real use |
| --- | --- |
| Motion: input | Every field on the login, code, setup and password pages: label, a stable message line, a shake when an error appears |
| Motion: checkbox | "Remember this device", posting with the form through a hidden field |
| Motion: alert | Refusals (a wrong password, the lockout, a wrong code), announced at once, and the pilot banner above every page, announced politely |
| Motion: loader | Each form's button while its action runs (the spinner, as CSS) |
| Motion: text animation (reveal) | The platform and college names over the login page's identity art, word by word (as CSS, so they paint with the HTML) |
| Blocks: bloom menu | The account menu in the header: the initials open into the name, the email, "change password" and "sign out". Step 10 adds the profile |

BeUI's one-time-code input was weighed for the admins' code and not adopted: the input above with `autocomplete="one-time-code"` takes a pasted or filled code as well, needs no words of its own for screen readers, and posts with the form before the JavaScript loads.

## Adopted in Step 7 (the settings screen)

| Component | Real use |
| --- | --- |
| Motion: switch | Yes-or-no settings: the pilot banner, the logo on the login page, Hijri display, the reminder rules |
| Motion: select | Choice settings: the language, the first day of the week, the digits, the digest's day |
| Motion: tabs | The settings groups, kept in the address; the list scrolls with arrows on a phone |
| Motion: adaptive stepper | Bounded counts (100 steps or fewer): password length, lockout threshold, session hours, remembered-device days, the weekly review cap, the file size, the digest's hour |
| Motion: range slider | The review sample rate, a percentage |
| Motion: action swap | Each setting's "Save", which turns into "Saving" and "Saved", and into "Confirm" when the password is asked for |

A wider count (minutes from 1 to 1,440) is typed in the motion input, with its unit under it.

BeUI's popover was weighed for the settings' descriptions and not adopted: a description shows under
its label, where it reads without a tap and stays visible while the value is chosen. The popover
joins with a later screen that has a real use for it.

## Adopted in Step 8 (the departments)

| Component | Real use |
| --- | --- |
| Motion: table | The departments list: each department's name and short name, how Rayat writes it (hidden on a phone) and its state, sorted from a header |
| Motion: breadcrumb | The page header's trail on a new department and on a department's page: Departments › the department |
| Motion: animated badge | A department's state, in the list and beside its name, which rolls to the other state when a save changes it |
| Motion: switch, input, action swap | The department form: in use or set aside, the names and the Rayat values, "Add department" and "Save" |

The table's selection, sticky header and virtualized rows join with the long lists that need them
(people, sections, the audit log).

## Adopted in Step 9 (roles and permissions)

| Component | Real use |
| --- | --- |
| Motion: combobox | Choosing the person for a membership, by name or employee number, typed in Arabic or Latin digits |
| Motion: table | The roles list: each role, how many hold it and how many keys it gives |
| Motion: switch, select, action swap | The grid's keys, the membership's scope, and "Save" turning into "Confirm" when the password is asked for |

The page order moves a page up or down with two buttons rather than by dragging: a short list, and
buttons work the same with a finger, a mouse and the keyboard.

## One component per job

Where a BeUI piece serves a job, it is the component for that job everywhere; the Step 4 primitive for the same job stays only in the design catalog until the UX review of Steps 1 to 10 removes it, with its dependency where it has one (Audit 2, minor 7).

| Job | The component | Leaves the catalog |
| --- | --- | --- |
| Text field | Motion: input | `ui/input` |
| Checkbox | Motion: checkbox | `ui/checkbox` |
| Command palette | Blocks: command palette | `ui/command`, and cmdk |
| Sheet and drawer | Motion: bottom sheet | `ui/sheet`, `ui/drawer`, and vaul |
| The account menu, a row's actions | Blocks: bloom menu (6), overflow actions (10) | `ui/dropdown-menu`, unless a step needs a plain menu |
| Yes or no, a choice, groups | Motion: switch, select, tabs (Step 7) | `ui/switch`, `ui/select`, `ui/tabs` |
| A count, a percentage | Motion: adaptive stepper, range slider (Step 7) | none |

The toast stays Sonner until the same review decides on BeUI's animated toast stack (docs/BACKLOG.md).

## The rest, by the step that first uses each one

| Step | Component | Real use |
| --- | --- | --- |
| 10 | Motion: table | People, then sections (17) and the audit log (11): selection, a sticky header, virtualized rows |
| 10 | Motion: animated badge | An account's state; then readiness (22) and task (26) states |
| 10 | Blocks: overflow actions | A person's row: reset the password, lock, disable |
| 11 | Motion: date range picker | The audit log's period filter; then holidays and exam weeks (13) |
| 11 | Motion: collapsible | An audit event's diff, and the history panel on entity pages |
| 11 | Motion: animated sidebar | The desktop sidebar once it has its administration group (settings, departments, roles, people, audit log): nested groups and the icon rail; the Step 5 list and its shared-layout pill move into it |
| 12 | Blocks: notification stack | The bell's notification center |
| 13 | Motion: adaptive stepper | The number of weeks in a term |
| 13 | Motion: select (morph) | The header's term switcher |
| 17 | Motion: combobox | The trainer of a section |
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

Not listed by the owner but fitting: BeUI's number ticker for "portfolio: 12 of 40" on Today
(Step 23). It joins only if its step finds it better than the plain primitive.
