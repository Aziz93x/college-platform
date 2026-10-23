import type { Locator } from "@playwright/test";

// Whether the point at the centre of a stepper's value reaches the value, not a shape drawn over
// it: at a bound, the button that leaves once rested over the number's first digit (UX review 2).
// A point is hit only on screen, so the value is brought into view first.
export function valueOnTop(stepper: Locator) {
  return stepper.locator("output").evaluate((output) => {
    output.scrollIntoView({ block: "center" });
    const box = output.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return hit !== null && output.contains(hit);
  });
}
