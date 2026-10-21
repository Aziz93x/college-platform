import type { Locator } from "@playwright/test";

// The controls in `scope` whose hit area is smaller than 44 by 44 px (docs/PLAN.md section 4):
// the center and the points 21 px above, below and to either side of it (1 px inside the edge, for
// subpixel layout) must reach the control, something inside it, or its label, and not a
// neighbour's hit area. Disabled controls are left out.
export function smallTargets(scope: Locator) {
  return scope.evaluate((root) => {
    const half = 44 / 2 - 1;
    const points = [
      [0, 0],
      [-half, 0],
      [half, 0],
      [0, -half],
      [0, half],
    ];
    const controls = root.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="switch"]',
        '[role="tab"]',
        '[role="combobox"]',
        '[role="menuitem"]',
        '[role="menuitemcheckbox"]',
        '[role="option"]',
        '[role="slider"]',
      ].join(", "),
    );
    const small: string[] = [];
    for (const control of controls) {
      if (
        control.matches(":disabled, [aria-disabled='true'], [data-disabled]") ||
        control.closest("[aria-hidden='true'], .sr-only") ||
        control.getClientRects().length === 0
      ) {
        continue;
      }
      control.scrollIntoView({ block: "center", inline: "center" });
      const box = control.getBoundingClientRect();
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      const labels = [...((control as HTMLInputElement).labels ?? [])];
      const reaches = (hit: Element | null) =>
        hit !== null &&
        (control.contains(hit) || labels.some((label) => label.contains(hit)));
      const covered = points.every(([dx, dy]) =>
        reaches(document.elementFromPoint(x + dx, y + dy)),
      );
      if (!covered) {
        const name =
          control.getAttribute("aria-label") ??
          (labels[0] ?? control).textContent?.trim();
        small.push(`${control.tagName.toLowerCase()} "${name}"`);
      }
    }
    return small;
  });
}
