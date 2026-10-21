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
  // the hidden fields its server adds to a form that posts to a server action.
  await settled(page);
  await page.waitForFunction(() => {
    const elements = [
      ...document.querySelectorAll('main, main *:not(input[type="hidden"])'),
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
