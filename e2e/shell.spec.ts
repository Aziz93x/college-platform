import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import messages from "../messages/ar.json" with { type: "json" };

const { shell, nav, today, pages } = messages;

const sidebar = (page: Page) =>
  page.locator("aside").getByRole("navigation", { name: shell.navigation });
const tabBar = (page: Page) =>
  page.locator("nav.fixed").filter({ has: page.getByRole("list") });

// WCAG 2.2 AA; only serious and critical violations fail. Arabic letters become Latin first, as in
// e2e/design.spec.ts, so axe checks their contrast instead of skipping them as icon ligatures.
async function seriousViolations(page: Page) {
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
    .analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }));
}

test("the address opens the shell on today's page, right to left in Arabic", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/today");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.title);
  await expect(page).toHaveTitle(today.title);
  await expect(
    page.getByRole("heading", { name: today.empty.title }),
  ).toBeVisible();
});

test("the notifications region takes its label from the message catalog", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(
    page.getByRole("region", { name: messages.toast.region }),
  ).toBeAttached();
});

test("the page carries the messages its client components read, not the whole catalog", async ({
  request,
}) => {
  const html = await (await request.get("/today")).text();
  expect(html).toContain(messages.ui.close);
  expect(html).not.toContain(messages.design.intro);
});

test("the current page is marked in the navigation of the device", async ({
  page,
  isMobile,
}) => {
  await page.goto("/today");
  const visible = isMobile ? tabBar(page) : sidebar(page);
  const hidden = isMobile ? sidebar(page) : tabBar(page);
  await expect(visible).toBeVisible();
  await expect(hidden).toBeHidden();
  await expect(visible.getByRole("link", { name: nav.today })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the skip link moves focus to the page's content", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a phone has no Tab key");
  await page.goto("/today");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: shell.skipToContent });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("Ctrl K and the search button open the page search, which opens the chosen page", async ({
  page,
  isMobile,
}) => {
  const palette = shell.commandPalette;
  await page.goto("/today");
  const search = page.getByRole("button", { name: shell.search });

  if (!isMobile) {
    await page.locator("main").click();
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("dialog", { name: palette.dialog }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: palette.dialog }),
    ).toBeHidden();
  }

  await search.click();
  const field = page.getByRole("combobox", { name: palette.dialog });
  await expect(field).toBeFocused();
  await field.fill("zzz");
  await expect(page.getByRole("listbox", { name: palette.list })).toContainText(
    palette.empty,
  );
  await field.fill(nav.today);
  await expect(page.getByRole("option", { name: nav.today })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: palette.dialog })).toBeHidden();
  await expect(page).toHaveURL("/today");
  await expect(search).toBeFocused();
});

test.describe("axe", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/today");
  });

  test("finds no serious issue in the shell", async ({ page }) => {
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("finds no serious issue with the page search open", async ({ page }) => {
    await page.getByRole("button", { name: shell.search }).click();
    await expect(
      page.getByRole("dialog", { name: shell.commandPalette.dialog }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test("an address with no page answers 404 with the catalog's not-found page", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    pages.notFound.title,
  );
  await page.getByRole("link", { name: pages.home }).click();
  await expect(page).toHaveURL("/today");
});

test("the image optimizer serves the identity art resized, as AVIF to a browser that takes it", async ({
  request,
}) => {
  const response = await request.get(
    "/_next/image?url=%2Fbrand%2Felement-curves.png&w=640&q=75",
    { headers: { accept: "image/avif,image/webp,image/*" } },
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/avif");
  // The source PNG is 340 kB at 2165 px wide.
  expect((await response.body()).length).toBeLessThan(40_000);
});
