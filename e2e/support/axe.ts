import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { settled } from "../screens/settled.ts";

// WCAG 2.2 AA; only serious and critical violations fail. Arabic letters become Latin first, so axe
// checks their contrast instead of skipping them as icon ligatures.
export async function seriousViolations(
  page: Page,
  disabledRules: string[] = [],
) {
  // Only once React has hydrated the page: rewritten before, the server's text no longer matches,
  // and React renders the page again with its Arabic. React hydrates each streamed Suspense boundary
  // in a later pass, so wait until it owns every element of main (its __reactFiber$ key), but for
  // the hidden fields its server adds to a form that posts to a server action, and the insides of
  // a drawing, which a component may draw itself (the stepper's liquid shapes).
  await settled(page);
  await page.waitForFunction(() => {
    const elements = [
      ...document.querySelectorAll(
        'main, main *:not(input[type="hidden"], svg *)',
      ),
    ];
    return (
      elements.length > 0 &&
      elements.every((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactFiber$")),
      )
    );
  });
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      node.nodeValue = (node.nodeValue ?? "").replace(
        /\p{Script=Arabic}/gu,
        "a",
      );
    }
  });
  // From the top of the page, as it loads: scrolled, the sticky header covers what passed under it,
  // and axe counts the header's buttons over a target against the target's size, so a check would
  // depend on where a test left the page (UX review 2).
  await page.evaluate(() => window.scrollTo(0, 0));
  // Axe measures colors as they are drawn, so a fade still running lowers a text's contrast: the page
  // header's eyebrow fades in over 500 ms, and a check made that soon after a page opened failed on
  // it at random. Wait for the running animations that end in time. One that repeats forever, one
  // paused, and one that follows the scroll (a sticky bar's shadow, `raise-on-scroll`) never finish,
  // so they are left as they are, and 5 s is the longest the wait lasts.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => {
            const endTime = animation.effect?.getComputedTiming().endTime;
            return (
              animation.timeline === document.timeline &&
              animation.playState === "running" &&
              typeof endTime === "number" &&
              Number.isFinite(endTime)
            );
          })
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .disableRules(disabledRules)
    .analyze();
  const arabicBack = await page.evaluate(() =>
    /\p{Script=Arabic}/u.test(document.body.innerText),
  );
  if (arabicBack) {
    throw new Error(
      "Arabic text was rendered again after the rewrite, so axe did not check its contrast",
    );
  }
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }));
}
