import { expect, test } from "./support/test.ts";

// Longer than the page takes to hydrate and to load Motion's features.
const HOLD_MS = 3000;

// React's streaming runtime puts a part of the page that arrives after the shell in a hidden
// segment, marks it queued, and reveals it on a later frame ($RV). This holds every reveal back, as
// a busy browser does, and counts the reveals it held.
function holdReveals(hold: number) {
  let reveal: ((batch: unknown) => void) | undefined;
  let held = 0;
  Object.defineProperty(window, "$RV", {
    configurable: true,
    get: () => {
      held++;
      return (batch: unknown) => setTimeout(() => reveal?.(batch), hold);
    },
    set: (value: (batch: unknown) => void) => {
      reveal = value;
    },
  });
  Object.defineProperty(window, "heldReveals", { get: () => held });
}

test("a streamed part of the page that waits to be revealed is hydrated in place, never drawn again beside itself", async ({
  page,
}) => {
  await page.addInitScript(holdReveals, HOLD_MS);
  await page.goto("/");
  expect(
    await page.evaluate(() => Reflect.get(window, "heldReveals")),
  ).toBeGreaterThan(0);
  // The sign-in form has arrived, and waits in its hidden segment for the reveal.
  const field = 'input[name="identifier"]';
  const arrived = await page.evaluateHandle(
    (selector) => document.querySelector(`div[hidden][id^="S:"] ${selector}`),
    field,
  );
  expect(await arrived.evaluate((node) => node !== null)).toBe(true);

  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, {
    timeout: HOLD_MS + 5000,
  });
  // The field the server sent, moved into place and hydrated: no copy drawn on the client.
  await expect(page.locator(field)).toHaveCount(1);
  await expect
    .poll(() =>
      arrived.evaluate(
        (node) =>
          node?.isConnected === true &&
          Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
});
