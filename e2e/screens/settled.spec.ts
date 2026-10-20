import { expect, test } from "@playwright/test";
import { settled } from "./settled";

// A streamed Suspense boundary as React leaves it in the document, with the content swapped in
// half a second after the load event.
for (const pending of ["$?", "$~"]) {
  test(`settled waits for a "${pending}" boundary to show its content`, async ({
    page,
  }) => {
    await page.setContent(`
      <main><!--${pending}--><p id="fallback">loading</p><!--/$--></main>
      <script>
        setTimeout(() => {
          const main = document.querySelector("main");
          main.firstChild.data = "$";
          main.querySelector("#fallback").outerHTML = '<p id="content">content</p>';
        }, 500);
      </script>`);
    expect(await page.locator("#fallback").isVisible()).toBe(true);

    await settled(page);
    expect(await page.locator("#content").isVisible()).toBe(true);
    expect(await page.locator("#fallback").count()).toBe(0);
  });
}
