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

