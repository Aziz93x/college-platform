import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// WCAG 2.2 AA; only serious and critical violations fail. Arabic letters become Latin first, so axe
// checks their contrast instead of skipping them as icon ligatures.
export async function seriousViolations(
  page: Page,
  disabledRules: string[] = [],
) {
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
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }));
}
