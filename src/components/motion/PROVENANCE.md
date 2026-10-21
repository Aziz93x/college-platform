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
| `range-slider.tsx` | `components/motion/range-slider.tsx` |
| `action-swap.tsx` | `components/motion/action-swap.tsx` |
| `lib/use-listbox.ts` | `lib/hooks/use-listbox.ts` |
| `lib/use-slider.ts` | `lib/hooks/use-slider.ts` |

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
