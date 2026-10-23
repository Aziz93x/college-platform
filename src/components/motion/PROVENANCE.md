# BeUI source provenance

BeUI (https://beui.dev) is Saurabh Chauhan's motion component catalog, MIT licensed (LICENSE in this
folder). These files are copied from https://github.com/starc007/ui-components at commit
`802f83ed09aa3b7fa6c53fbe96ff03621003cd75`, BeUI's React edition (React, Tailwind CSS and Motion).

| Here | Upstream |
| --- | --- |
| `alert.tsx` | `components/motion/alert.tsx` |
| `bloom-menu.tsx` | `components/motion/bloom-menu.tsx` |
| `bottom-sheet.tsx` | `components/motion/bottom-sheet.tsx` |
| `checkbox.tsx` | `components/motion/checkbox.tsx` |
| `command-palette.tsx` | `components/motion/command-palette.tsx` |
| `dock.tsx` | `components/motion/dock.tsx` |
| `input.tsx` | `components/motion/input.tsx` |
| `loader.tsx` | `components/motion/loader.tsx` |
| `shared-layout-bg.tsx` | `components/motion/shared-layout-bg.tsx` |
| `text-reveal.tsx` | `components/motion/text-reveal.tsx` |
| `lib/ease.ts` | `lib/ease.ts` |
| `lib/presence-gate.tsx` | `lib/presence-gate.tsx` |
| `lib/use-focus-trap.ts` | `lib/hooks/use-focus-trap.ts` |
| `lib/use-on-open.ts` | `lib/hooks/use-on-open.ts` |
| `lib/use-row-cursor.ts` | `lib/hooks/use-row-cursor.ts` |
| `lib/use-touch-capable.ts` | `lib/hooks/use-touch-capable.ts` |
| `lib/command-search.ts` | `lib/command-search.ts` |
| `switch.tsx` | `components/motion/switch.tsx` |
| `select.tsx` | `components/motion/select.tsx` |
| `tabs.tsx` | `components/motion/tabs.tsx` |
| `adaptive-stepper.tsx` | `components/motion/adaptive-stepper.tsx` |
| `liquid.tsx` | `components/motion/liquid.tsx` |
| `animated-badge.tsx` | `components/motion/animated-badge.tsx` |
| `breadcrumb.tsx` | `components/motion/breadcrumb.tsx` |
| `table/index.tsx` | `components/motion/table/index.tsx` |
| `table/table-header.tsx` | `components/motion/table/table-header.tsx` |
| `table/types.ts` | `components/motion/table/types.ts` |
| `table/use-column-sort.ts` | `components/motion/table/use-column-sort.ts` |
| `table/utils.ts` | `components/motion/table/utils.ts` |
| `combobox/context.tsx` | `components/motion/combobox/context.tsx` |
| `combobox/content.tsx` | `components/motion/combobox/content.tsx` |
| `combobox/list.tsx` | `components/motion/combobox/list.tsx` |
| `combobox/trigger.tsx` | `components/motion/combobox/trigger.tsx` |
| `combobox/use-active-option.ts` | `components/motion/combobox/use-active-option.ts` |
| `multi-select/context.tsx` | `components/motion/multi-select/context.tsx` |
| `multi-select/content.tsx` | `components/motion/multi-select/content.tsx` |
| `multi-select/list.tsx` | `components/motion/multi-select/list.tsx` |
| `multi-select/trigger.tsx` | `components/motion/multi-select/trigger.tsx` |
| `multi-select/index.tsx` | `components/motion/multi-select/index.tsx` |
| `lib/popover-position.ts` | `components/motion/popover-position.ts` |
| `range-slider.tsx` | `components/motion/range-slider.tsx` |
| `action-swap.tsx` | `components/motion/action-swap.tsx` |
| `lib/use-listbox.ts` | `lib/hooks/use-listbox.ts` |
| `lib/use-slider.ts` | `lib/hooks/use-slider.ts` |
| `overflow-actions.tsx` | `components/motion/overflow-actions.tsx` |
| `lib/use-hover-capable.ts` | `lib/hooks/use-hover-capable.ts` |
| `popover-morph.tsx` | `components/motion/popover-morph.tsx` |
| `date-range-picker/index.tsx` | `components/motion/date-range-picker.tsx` |
| `date-range-picker/context.ts` | `components/motion/date-range-picker/context.ts` |
| `date-range-picker/date-utils.ts` | `components/motion/date-range-picker/date-utils.ts` |
| `date-range-picker/types.ts` | `components/motion/date-range-picker/types.ts` |
| `date-range-picker/use-date-range-picker.ts` | `components/motion/date-range-picker/use-date-range-picker.ts` |
| `collapsible.tsx` | `components/motion/collapsible.tsx` |
| `animated-sidebar.tsx` | `components/motion/animated-sidebar.tsx` |
| `notification-stack.tsx` | `components/motion/notification-stack.tsx` |
| `lib/use-dismiss.ts` | `lib/hooks/use-dismiss.ts` |
| `lib/use-hover-gesture.ts` | `lib/hooks/use-hover-gesture.ts` |
| `lib/use-tap-gesture.ts` | `lib/hooks/use-tap-gesture.ts` |

## Local changes

- Every word a person reads or hears comes from the message catalog: the English defaults
  ("Close bottom sheet", "Type a command or search…", "No results found.", "Command palette",
  "Commands", "Results", "ESC") became required props. The sheet's `title` is required and names
  the dialog.
- Classes follow this design system: Medium instead of semibold (the identity ships two weights),
  the small radius scale (`rounded-xl` for the sheet and the palette), `shadow-lg`, `text-start`
  instead of `text-left`, and no uppercase or letter spacing on group headings, which would break
  Arabic.
- The sheet takes `dvh` heights and pads for the home indicator (`safe-area-inset-bottom`); its
  unused `heightRef` is gone, and the class from `lib/touch.ts` is inlined.
- The palette's icon is a rendered element (a server component can pass it), its rows and scrim
  leave the tab order, and `useFocusTrap` keeps Tab on the field and returns focus to the opener.
  Items without a group get no heading, and an optional `footer` shows under the list.
- The dock is a list (`ul` and `li`), so a dock of links inside a `nav` reads as a list of
  pages; its items carry their own link or button and size from their content, which drops the
  `size` prop, the button mode and the separator, and the pill takes a `pillClassName`.
- The shared-layout pill's container no longer repeats `custom={activeId !== null}`, which is
  always true where it renders; `AnimatePresence` hands its own `custom` to a container on its way
  out, the only place the exit variant reads it.
- `useFocusTrap` captures the opener in a layout effect rather than a passive one, so a panel
  that mounts already open still returns focus to the control that opened it.
- `lib/ease.ts` keeps only the tokens in use, and helper types are no longer exported.
- The components render `m` elements from `motion/react-m` instead of `motion`, under
  `MotionProvider` (`motion-provider.tsx`, local), which loads Motion's features after the page
  has painted.
- Imports point at this folder and at `@/components/ui/cn`.

## Local changes from Step 6 (sign-in)

- `input.tsx`: the label is required, and a field without a `value` stays uncontrolled, so a form action's reset empties it. The success state and its check mark are gone, `leftIcon` and `rightIcon` became `startIcon` and `endSlot` on logical sides, an optional `hint` shares the message line, and the error shake runs through the Web Animations API instead of Motion's `animate`. The field takes `rounded-lg`, the input border and the `alert` color for errors; `ref` is a prop (React 19).
- `checkbox.tsx`: controlled and labelled only, without the indeterminate state; `name` adds a hidden field while it is checked, so it posts with its form as a native checkbox does. The label row is 44 px on a touch screen, and the check mark's English `<title>` is gone (the mark is hidden from assistive technology).
- `alert.tsx`: two variants on the tokens, `info` (announced politely, `role="status"`) and `alert` (at once, `role="alert"`), each with its icon; `AlertTitle` and `AlertDescription` remain, and the close, action, context and `useAlert` parts, unused here, are gone.
- `loader.tsx`: the spinner only, its turn a CSS animation (`animate-spin`), so it needs no client JavaScript and stops under reduced motion; it is announced only when given a label.
- `text-reveal.tsx`: rewritten as a server component with the same look, word by word with a 90 ms stagger, rising out of a blur on BeUI's easing, as the CSS animation `--animate-reveal` in `src/styles/theme.css`, so the words paint with the page's HTML. The blur is 8 px, and under reduced motion the words are simply there.
- `bloom-menu.tsx`: the trigger and the items come from props (`trigger`, `triggerLabel`, `heading`, `items` with links or actions and a busy state), and the panel opens from the trigger's top corner at the end instead of its center, as an account menu in a header does. Arrow keys follow the reading direction, the grid takes as many columns as items up to three, and the close button's label comes from the catalog.

## Local changes from Step 7 (the settings screen)

- Every component renders `m` elements under `MotionProvider`, takes its words as props from the
  catalog, and keeps its first render the same on the server and on a client that prefers reduced
  motion: no initial style, variant or `tabIndex` depends on `useReducedMotion()` there.
  `MotionProvider`'s `reducedMotion="user"` drops the movement instead.
- `switch.tsx`: named by `aria-labelledby` (a setting's label), with a 44 px hit area around its
  28 px track; on sits at the inline end, so right to left the thumb travels left; the disabled
  shake, through Motion's `animate`, is gone.
- `select.tsx`: controlled open state only from inside; the trigger is a field like the text
  fields (44 px, `rounded-lg`, the input border and focus ring) and reads `aria-labelledby` before
  the chosen option; the English placeholder is gone; options take their words as children and are
  44 px on a touch screen; `text-start` instead of `text-left`. `lib/use-listbox.ts` is copied as is.
- `tabs.tsx`: the pill variant only (the underline, segment and selected-only icon variants are
  gone), controlled, with the list's name and the scroll arrows' names as props; the panel the page
  opens on is drawn as the server sent it, and only a panel chosen later fades in; tabs are 44 px on
  a touch screen.
- `adaptive-stepper.tsx` and `liquid.tsx`: controlled, with the buttons' names, the value's words
  and its digits as props; the English legend is gone (the fieldset is named by
  `aria-labelledby`); right to left the whole stepper is mirrored with its number turned back, so
  lower values sit at the start; the liquid surface takes a height of its own, since percentages do
  not resolve inside a fieldset; `Liquid` takes `ref` as a prop (React 19).
- `range-slider.tsx` and `lib/use-slider.ts`: controlled; right to left the drawing is mirrored and
  the pointer and the left and right arrows follow it; the handle has a 44 px hit area and the
  track's border is drawn over it so the hit area is not clipped; the fill and handle take the
  primary color.
- `action-swap.tsx`: the blur swap only (the roll and the letter cascade, which would split joined
  Arabic letters, are gone), two variants on the tokens, the text layer at the inline start.
- `lib/command-search.ts`: Arabic words match with or without the article and across hamza, taa
  marbuta and alef maqsura spellings.
- `checkbox.tsx` and `input.tsx` (Step 6): the checkbox pins `tabIndex` as above, and the input
  draws its border over the field, so the input fills all 44 px of it.

## Local changes from Step 8 (the departments)

- `animated-badge.tsx`: two states on the identity's tokens, `neutral` (set aside) and `success`
  (in use: the teal fill and icon with the primary blue for the words, since the identity has no
  green dark enough for small text); one size, 28 px; the words are a string, which keys the roll;
  the pulse, the custom icon and the content key are gone. `SPRING_SWAP` moved to `lib/ease.ts`,
  shared with the action swap.
- `breadcrumb.tsx`: the trail's name is required; links render the router's `Link` through
  `render` and are 44 px on a touch screen; the separator turns with the reading direction; the
  ellipsis and its popover, for trails longer than this platform's, are gone; `ref` is a prop
  (React 19).
- `table/`: columns, sorting from a header and the empty row only, with the caption required for
  screen readers; selection, column resizing and reordering, editable cells, row handles, the menu,
  skeleton rows and virtualized rows are gone until a list needs them. Sorting compares text in the
  page's language (`Intl.Collator`); `align` takes `start`, `center` and `end`; a column takes
  classes of its own, to hide it on a phone; the header's labels take the foreground color, since
  the muted one is too light on its fill; a narrow screen scrolls the table inside its frame.

## Local changes from Step 9 (roles and permissions)

- `combobox/`: controlled only, with the chosen value held by the page; the filter is the command
  palette's Arabic search (with or without the article, across spellings), and digits typed on an
  Arabic keyboard match Latin ones; the field looks like the text fields (44 px, `rounded-lg`, the
  input border drawn over it so the input fills all 44 px, the focus ring); its visible name is
  `ComboboxLabel`, tied to the input; the list's name and the empty message come from the catalog,
  with no English defaults; options are 44 px on a touch screen and read `text-start`; the panel is
  as wide as the field and portalled with `m` elements; groups, labels inside the list,
  separators, the value view and the side and alignment options are gone. `use-active-option.ts`
  is copied as is; `lib/popover-position.ts` takes refs that may hold nothing.

## Local changes from Step 10 (people and accounts)

- `overflow-actions.tsx`: the overflow items only (`actions`), each with a label, an icon and its
  action; the primary actions, the controlled open state, the callbacks and the class slots are
  gone until a step needs them, and a chosen action always closes the group. The toggle's names
  while closed and open are required props from the catalog, it and the actions are 44 px, and the
  toggle rests as a quiet icon button that turns into the bold one, inside its card, while the
  actions show. `lib/use-hover-capable.ts` is copied as is.
- `animated-badge.tsx`: two more states on the identity's tokens, `pending` (an invited account, a
  role to be added: the primary tint with a clock) and `alert` (a locked account, a row with errors:
  the alert tint with its icon).
- `bloom-menu.tsx`: a link item closes the menu as it opens its page, which the shell keeps, menu
  and all, when the page is one of its own.

## Local changes from Step 11 (the audit log)

- `date-range-picker/`: controlled only, with the range held by the page; every word it shows or
  announces is one of `DateRangePickerWords`, from the catalog's `dateRange` messages, with no
  English defaults; the college's locale names the months and weekdays and writes the digits, and
  `weekStartsOn` its first column; the arrow keys follow the reading direction; the presets, the
  uncontrolled value and open state, the default month and the per-day refusal are gone. The
  trigger looks like the text fields (44 px, `rounded-lg`, the input border and the focus ring),
  fills its row, and shows an unchosen period in the muted color, which keeps its contrast.
- `popover-morph.tsx`: `align` is the trigger's start or end in its reading direction, so the panel
  opens from the right corner of a right-to-left page; `m` elements; the position helper is the
  combobox's `lib/popover-position.ts`.
- `collapsible.tsx`: uncontrolled (`defaultOpen`), without the disabled state, the `useCollapsible`
  hook or the trigger's `render`; the trigger is 44 px and reads `text-start`. The content is no
  `region`: a log of fifty events would list fifty landmarks, and the trigger already names it.
- `animated-sidebar.tsx`: the desktop part only. The provider is the sidebar itself, which takes
  its first state (`defaultOpen`, from the shell's cookie) and reports each change
  (`onOpenChange`); its width moves between `--sidebar-width` and `--sidebar-width-icon`, and its
  `data-state` lets the server-rendered children fold with group variants. The trigger and the
  rail name what a press does now from the catalog (`label`); the rail sits on the inner edge in
  either direction and stays out of the tab order and the accessibility tree. The phone sheet, the
  off-canvas and floating variants, the inset, the header, content and footer wrappers, the menu
  buttons and the sub-menus are gone: the phone keeps its tab bar, and no page has sub-pages.
- `overflow-actions.tsx`: no branch on reduced motion while rendering, which drew a reduced-motion
  client's first render unlike the server's HTML; `MotionProvider`'s `reducedMotion="user"` drops
  the movement instead.

## Local changes from Step 12 (notifications)

- `notification-stack.tsx`: every word comes from props (`labels`, with the stack's name while closed
  and once open, and the count in the page's digits); the stack is in flow, so it opens downward and
  the bell's panel grows with it, rather than rising over what comes before it; the controlled
  `expanded`, `defaultExpanded`, `onExpandedChange` and the class-name slots are gone; Escape closes an
  open stack before the panel around it; the count takes the primary color, the cards the small radius
  scale and `text-start`; the empty state is an `output`, so its words are announced when the last card
  is read, in the foreground color for contrast; the footer swaps its words with the action swap's blur
  and its arrow turns with the reading direction. Only the movement's timing follows reduced motion.
- `action-swap.tsx` exports `ActionSwapText`, for the stack's footer and the bell's count.
- `lib/use-hover-gesture.ts` takes `isHoveringPointer` in itself from `lib/touch.ts`;
  `lib/use-dismiss.ts` and `lib/use-tap-gesture.ts` are copied as is, but for the types no one else
  reads, which are no longer exported.
- `date-range-picker`: a `today` prop gives the day on the college's clock, which the calendar marks
  and opens on; a browser on another clock, such as a test runner's in UTC after midnight in Riyadh,
  marked its own day (found by this step's end-to-end run).

## Local changes from lead review B (ADR-0015, ADR-0016)

- `notification-stack.tsx`: a group of links with a button at its foot, no longer one button. Each card is a link (`href`) that calls `onOpen` before it is followed, so the bell reads the notification first; the cards the closed stack hides are `aria-hidden` and out of reach. The foot keeps the stack's tap logic: its first activation opens the list, its second `onViewAll`, and its name and `aria-expanded` say which. A resting pointer opens the list as before, but focus opens it only when it is the keyboard's (`:focus-visible`) and comes from outside the stack, so a browser that focuses on contact does not spread the cards under a finger mid-tap. Escape gives the focus to the foot before the hidden cards close over it. The foot is 44 px tall. A hovered card's muted words take the foreground colour, as the center's rows do: muted on the hover's tint measures under 4.5:1.
- `select.tsx`: `SelectValue` takes a `placeholder`, in the muted colour, for a choice with no default (the role to give on a person's page).

## Local changes from lead review C

- `select.tsx`: the open list is bounded to the room on the side it opens to, within the viewport and every ancestor that clips its overflow (a sheet's scrolling body), less an 8 px margin, and scrolls past it, at least about three options tall. A long list opened upward in a bottom sheet ran off the top of the screen, where neither a finger nor a mouse could reach its first options (the framework item's kinds, a transfer's weeks). The option focus follows, as before, scrolls into view.

## Local changes from UX review 1 (docs/reviews/ux-10.md)

- `liquid.tsx` and `adaptive-stepper.tsx`: at rest each shape is drawn by its own element, with a CSS
  fill and an inset edge, which stays crisp on a 1x screen; the goo filter runs only while shapes
  merge or split. The stepper draws on its 216 by 48 grid times its rendered size, so enlarged text
  or a narrow row scales the shapes with it and the value never clips (F1, F5).
- `range-slider.tsx`: the track takes the card's colour and the fill `primary/25`, so the value
  reads at a glance (F5).
- `tabs.tsx`: the scroll arrows are opaque and the fade starts past them, so no label shows half
  under one (F5).
- `table/index.tsx`: the scrolling frame is positioned, so the headers' screen-reader text scrolls
  with the table instead of widening the page (F1).
- `checkbox.tsx`: a 44 px hit area around the 20 px box, as the switch has.
- `combobox/list.tsx`: on the highlighted row's muted ground, secondary text (an employee number)
  takes the foreground colour; muted on muted measured 3.2:1.
- `date-range-picker`: on a touch screen the panel is 24rem wide (within the screen), its padding
  smaller and its month, year and arrow buttons 44 px, so each day is 44 px wide on a phone of
  360 px or more.

## Local changes from Step 13 (terms and their calendars)

- `date-range-picker/`: `single` chooses one day, the term's first one: a tap completes the value,
  from and to that day, and announces it with the catalog's `dayChosen`. The trigger writes a value
  that starts and ends on one day as that day, a one-day holiday too.

## Local changes from the design system audit (22 October 2026)

- `date-range-picker/`: on the theme's scales. The panel's corners take `rounded-xl`, the largest
  radius here; BeUI's `rounded-2xl` is no step of this theme, so the panel had square corners. The
  month, the year and the month and year choices take `text-sm`, and the weekday letters `text-xs`,
  where BeUI had 13 and 11 px. The month and today's date take the Medium weight: the identity has
  no semibold, so `font-semibold` drew them Regular.
- `combobox/content.tsx`: the list's words take `text-foreground`; `text-popover-foreground` names no
  token here and did nothing.
- `switch.tsx`, `breadcrumb.tsx`, `combobox/list.tsx`, `notification-stack.tsx` and
  `animated-badge.tsx`: their transitions run on `--duration-fast` and `--duration-slow` (120 and
  200 ms) instead of BeUI's 150, 200 and 300 ms.

## Local changes from UX review 2 (docs/reviews/ux-20.md)

- `adaptive-stepper.tsx`: at a bound, the button that leaves rests under the value, which flows over
  its place. Drawn after the value, the increment's resting circle covered the number's first digit
  at the upper bound ("18" read "8"). The fieldset takes `min-w-0`, so a narrow row can shrink it
  below its 13.5rem: at 200% text that width set the term pages' least width (F1).
- `lib/popover-position.ts`: while active, the panel follows its trigger frame by frame, since a
  trigger can move without a scroll or a resize: the transfer sheet focuses its trainer picker as
  it slides in, which opens the list, and the list stayed where the field had been, over it.
  `combobox/content.tsx` is active only while its list is open, so a closed one follows nothing.

## Local changes from Step 21 (assignments)

- `multi-select/`: made as the combobox was in Step 9. It is controlled only, and the page holds
  the chosen values in the order they were chosen. A pick keeps the list open, clears what was
  typed and leaves the focus in the field.
  - The filter is the combobox's Arabic search, with digits typed on an Arabic keyboard matching
    Latin ones.
  - The field looks like the text fields (at least 44 px, `rounded-lg`, the input border drawn over
    it, the focus ring) and grows with the chips that wrap in it.
  - Its visible name is `MultiSelectLabel`, tied to the input. The list's name, the chips' names
    (`removeLabel`) and the empty message come from the catalog, with no English defaults.
  - A chip is one button that takes its option out: drawn 28 px tall, 44 px on a touch screen, as
    the field's input is, so a row of chips meets the touch target where a separate 20 px button
    would sit too close to the next row.
  - Options are 44 px on a touch screen and read `text-start`. A chosen one keeps the foreground
    colour, as the highlighted one does.
  - The panel is the combobox's (`content.tsx`), which follows its field while open. The chips
    enter and leave by scale and opacity, without the clip-path exit.
  - Escape in the field closes an open list and goes no further. A sheet's focus trap hears keys on
    the document, before the list's listener on the window, so the key closed the whole sheet.
  - Gone: groups, labels and separators inside the list, the uncontrolled value, open state and
    query, and the side and alignment options.
