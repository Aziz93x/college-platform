import type { Page } from "@playwright/test";

// Resolves once the page shows its content rather than its loading state. React streams a
// Suspense boundary's fallback first and swaps in the content later, even after the load event: a
// "$?" comment marks a boundary still waiting for its content and "$~" one waiting to be revealed.
// A fallback drawn on the client has no such comment: one the router shows on its way to another
// page, such as where a redirect sent mid-stream leads (a temporary password's owner opening Today).
// Every loading state is marked busy; a control that says it is working is not a loading state.
export async function settled(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[aria-busy="true"]:not(button)')) return false;
    const comments = document.createTreeWalker(
      document,
      NodeFilter.SHOW_COMMENT,
    );
    for (let node = comments.nextNode(); node; node = comments.nextNode()) {
      const { data } = node as Comment;
      if (data === "$?" || data === "$~") return false;
    }
    // An image in a part of the page that is not shown (the sidebar on a phone) is never fetched.
    return [...document.images].every(
      (image) => image.complete || !image.checkVisibility(),
    );
  });
  await page.evaluate(() => document.fonts.ready);
}
