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

## Adopted in Step 10 (people and accounts)

| Component | Real use |
| --- | --- |
| Motion: table | The people list: each person's name and employee number, email (hidden on a phone), roles and where (hidden on a phone) and the account's state, sorted from a header; the import's preview, a row per line of the file with what it would do |
| Motion: animated badge | An account's state: active, invited (pending), locked (alert) or disabled; each row's outcome in the import's preview |
| Blocks: overflow actions | A person's row: a temporary password, turning two-factor off, disabling or enabling the account. The "…" rests quietly in each row and opens into the actions, bold while open. On the person's page the same actions are labelled buttons in an "Account actions" card (UX review 1) |
| Motion: input, select, action swap, bottom sheet | Adding a person, correcting a person's name, email and employee number, and the sheet that confirms an account action and shows a temporary password once |

Locking is no action: an account locks itself after failed attempts and a temporary password lifts
it. The table's selection, sticky header and virtualized rows still wait for a list that needs them:
a college's people fit one page, and nothing acts on several people at once yet.

## Adopted in Step 11 (the audit log)

| Component | Real use |
| --- | --- |
| Motion: date range picker | The log's period: days up to today on the college's clock, from its first day of the week and in its digits, in a panel from a trigger that looks like the text fields |
| Motion: popover (morph) | The date range picker's panel, which opens from the trigger's corner |
| Motion: collapsible | Each event of the log and of a record's history: the row opens to what changed, before and after, and in the log to the address and device |
| Motion: combobox | The log's action filter: the 23 actions, found by their names or their group's |
| Motion: input | The log's person filter: a name, an employee number or an email |
| Motion: animated sidebar | The desktop sidebar: the administration pages under their group's name, and the icon rail it folds to from its toggle, its inner edge or Ctrl (Cmd) + B, kept for the next page; the Step 5 list and its shared-layout pill moved into it |

The log is a list of days rather than a table: a row opens to its changes, which a table's row cannot
hold, and the list keeps its layout on a phone. A page holds 50 events and older ones follow by
keyset, so no row needs virtualizing; the table's selection, sticky header and virtualized rows wait
for sections (Step 17). The sidebar's sub-menus and its phone sheet stay out: no page has sub-pages
yet, and a phone keeps the tab bar and its "More" sheet, which the admin's sixth page now opens.

## Adopted in Step 12 (notifications)

| Component | Real use |
| --- | --- |
| Blocks: notification stack | The bell's panel: the newest unread notifications stacked behind the newest, which spring apart into a list on hover, focus or the first tap; the next activation opens the notification center. Its code loads when the bell is first reached for |
| Motion: action swap | The unread count on the bell, which swaps to the next number as the count changes, and the stack's footer, from "unread" to "view all" |
| Motion: switch | Each kind of notification on or off in the preferences |

The bell's panel hangs from the header as a disclosure, not from the morph popover: the popover would
add 9 KiB of script to every page (ADR-0010), and a phone gets the panel at the screen's width. The
stack opens downward inside the panel, which grows with it, rather than over what comes before it.

## One component per job

Where a BeUI piece serves a job, it is the component for that job everywhere. The UX review of Steps 1 to 10 removed the Step 4 primitives that had lost their job, with their dependencies (Audit 2, minor 7; docs/reviews/ux-10.md, C7). The design catalog (`/design`) shows the components below in their states, then the primitives that no BeUI component replaces: the button, the text area, the label, the form, the radio group, the avatar, the skeleton, the progress bar, the separator, the scroll area, the dialog, the tooltip and the toast.

| Job | The component | Left the catalog in UX review 1 |
| --- | --- | --- |
| Text field | Motion: input | `ui/input` |
| Checkbox | Motion: checkbox | `ui/checkbox` |
| Command palette | Blocks: command palette | `ui/command`, and cmdk |
| Sheet and drawer | Motion: bottom sheet | `ui/sheet`, `ui/drawer`, and vaul |
| The account menu, a row's actions | Blocks: bloom menu (6), overflow actions (10) | `ui/dropdown-menu` |
| Yes or no, a choice, groups | Motion: switch, select, tabs (Step 7) | `ui/switch`, `ui/select`, `ui/tabs` |
| A list to choose from as you type | Motion: combobox (Step 9) | none |
| A count, a percentage | Motion: adaptive stepper, range slider (Step 7) | none |
| A list of records | Motion: table (Step 8) | `ui/table` |
| A state | Motion: animated badge (Step 8) | `ui/badge` |
| A period of days | Motion: date range picker (Step 11) | `ui/calendar`, `ui/popover`, and react-day-picker. A step that needs a single day asks the picker for a one-day range |

The toast stays Sonner: it is tokenized, announced in its own region and loaded only by the layouts that toast; BeUI's toast stack would add script and a second stack beside the bell's (UX review 1, decision 8).

## Patterns

Built on the components above, alike on every screen (UX review 1, C2 to C5).

| Job | The pattern |
| --- | --- |
| Editing a record | Nothing at the form's foot while the record is as saved. Once something changed, Save beside Discard; Save turns into "Saved" for 2 s (`src/components/save-actions.tsx`). A record saves with one button; independent values, such as the settings, save one at a time |
| Creating a record | The primary button is always shown, with a "Cancel" ghost beside it that leads back to the list |
| Searching a list | One field: its name for screen readers only, a clear button, Escape clears, the count announced politely, Arabic-Indic digits read as Latin. With no match, "No results for «…»" with a button that clears the search; the identity art is kept for a list with nothing in it yet (`src/components/search-field.tsx`) |
| Changing someone's access | A bottom sheet that names the person and the change, asks for the password again when it is due, and has a visible Cancel beside the confirmation |
| An account task the person chooses | Changing the password or turning two-factor on stays in the shell, under the profile. Only the forced steps (the first password, a required two-factor) use the sign-in layout |

## The rest, by the step that first uses each one

The owner's rule of 22 October 2026 (docs/PLAN.md, section 0) wins over this table: no more animated components. A component below that is not yet in `src/components/motion/` comes in only for something none of those there, the shadcn/Radix components or native controls can do, and its pull request says why. Step 21 chose several people with a search field over the department's list of checkboxes, so the multi select stayed out (Audit 7, minor 6); choosing several people or kinds in Steps 22 and 29 does the same.

| Step | Component | Real use |
| --- | --- | --- |
| 10 | Motion: table | People, then sections (17): selection, a sticky header, virtualized rows |
| 10 | Motion: animated badge | An account's state; then readiness (22) and task (26) states |
| 10 | Blocks: overflow actions | A person's row: reset the password, lock, disable |
| 11 | Motion: date range picker | The audit log's period filter; then holidays and exam weeks (13) |
| 12 | Blocks: notification stack | The bell's panel (adopted, above) |
| 13 | Motion: adaptive stepper | The number of weeks in a term |
| 13 | Motion: select (morph) | The header's term switcher |
| 17 | Motion: combobox | The trainer of a section |
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
