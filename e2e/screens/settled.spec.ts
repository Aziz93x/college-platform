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

// A loading state React draws on the client, as the router does on its way to another page:
// no comment marks it, only its aria-busy.
test("settled waits for a loading state drawn on the client to give way to the content", async ({
  page,
}) => {
  await page.setContent(`
    <main><div aria-busy="true" id="fallback">loading</div></main>
    <script>
      setTimeout(() => {
        document.querySelector("#fallback").outerHTML = '<p id="content">content</p>';
      }, 500);
    </script>`);
  expect(await page.locator("#fallback").isVisible()).toBe(true);

  await settled(page);
  expect(await page.locator("#content").isVisible()).toBe(true);
  expect(await page.locator("#fallback").count()).toBe(0);
});

test("a control that says it is working does not hold settled back", async ({
  page,
}) => {
  await page.setContent(
    `<main><button disabled aria-busy="true">saving</button></main>`,
  );
  await settled(page);
  expect(await page.getByRole("button").getAttribute("aria-busy")).toBe("true");
});
