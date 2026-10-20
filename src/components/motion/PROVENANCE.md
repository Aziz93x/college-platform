# BeUI source provenance

BeUI (https://beui.dev) is Saurabh Chauhan's motion component catalog, MIT licensed (LICENSE in this
folder). These files are copied from https://github.com/starc007/ui-components at commit
`802f83ed09aa3b7fa6c53fbe96ff03621003cd75`, BeUI's React edition (React, Tailwind CSS and Motion).

| Here | Upstream |
| --- | --- |
| `bottom-sheet.tsx` | `components/motion/bottom-sheet.tsx` |
| `command-palette.tsx` | `components/motion/command-palette.tsx` |
| `dock.tsx` | `components/motion/dock.tsx` |
| `shared-layout-bg.tsx` | `components/motion/shared-layout-bg.tsx` |
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
