import type { Page } from "@playwright/test";

// Resolves once the page shows its content rather than its loading state. React streams a
// Suspense boundary's fallback first and swaps in the content later, even after the load event: a
// "$?" comment marks a boundary still waiting for its content and "$~" one waiting to be revealed.
export async function settled(page: Page) {
  await page.waitForFunction(() => {
    const comments = document.createTreeWalker(
      document,
      NodeFilter.SHOW_COMMENT,
    );
    for (let node = comments.nextNode(); node; node = comments.nextNode()) {
      const { data } = node as Comment;
      if (data === "$?" || data === "$~") return false;
    }
    return [...document.images].every((image) => image.complete);
  });
  await page.evaluate(() => document.fonts.ready);
}
