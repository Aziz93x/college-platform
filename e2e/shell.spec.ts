import type { Locator, Page } from "@playwright/test";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoSettings } from "../db/seed/demo/settings.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { expect, test } from "./support/test.ts";

const { shell, nav, today, pages } = messages;

// The shell as the demo trainer sees it (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.trainer });

const sidebar = (page: Page) =>
  page.locator("aside").getByRole("navigation", { name: shell.navigation });
const tabBar = (page: Page) =>
  page.locator("nav.fixed").filter({ has: page.getByRole("list") });

test("the address opens the shell on today's page for someone signed in, right to left in Arabic", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/today");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.title);
  // The page's name, then the platform's: the demo college's own, from seed:demo.
  await expect(page).toHaveTitle(
    `${today.title} · ${demoSettings["platform.name"]}`,
  );
  await expect(
    page.getByRole("heading", { name: today.empty.title }),
  ).toBeVisible();
  // With nothing for the trainer yet, Today leads to their next page: the term's framework.
  await expect(
    page.locator("main").getByRole("link", {
      name: today.empty.next.replace("{page}", nav.framework),
    }),
  ).toHaveAttribute("href", "/framework");
});

// Sonner loads only where toasts show (ADR-0010, the script budget); design.spec.ts checks the
// region's label there.
test("the shell carries no toaster until one of its screens shows toasts", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.title);
  await expect(
    page.getByRole("region", { name: messages.toast.region }),
  ).toHaveCount(0);
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.title);
  if (isMobile) {
    // The trainer's two pages, Today and the term's framework, sit in the phone's tab bar.
    await expect(sidebar(page)).toBeHidden();
    await expect(
      tabBar(page).getByRole("link", { name: nav.today }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      tabBar(page).getByRole("link", { name: nav.framework }),
    ).toBeVisible();
    return;
  }
  await expect(sidebar(page)).toBeVisible();
  await expect(tabBar(page)).toBeHidden();
  await expect(
    sidebar(page).getByRole("link", { name: nav.today }),
  ).toHaveAttribute("aria-current", "page");
});

// The rectangles of the controls in `scope` that are off a screen `width` px wide or smaller than
// 44 px, as "name x..right × height".
const cramped = (scope: Locator, width: number) =>
  scope.locator("a, button").evaluateAll(
    (controls, screen) =>
      controls
        .filter((control) => control.getClientRects().length > 0)
        .map((control) => ({
          name:
            control.getAttribute("aria-label") ?? control.textContent?.trim(),
          box: control.getBoundingClientRect(),
        }))
        .filter(
          ({ box }) =>
            box.left < 0 ||
            box.right > screen ||
            box.width < 44 ||
            box.height < 44,
        )
        .map(
          ({ name, box }) =>
            `${name} ${Math.round(box.left)}..${Math.round(box.right)} × ${Math.round(box.height)}`,
        ),
    width,
  );

// How far the page scrolls sideways: nothing on a phone.
const sideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("as the admin", () => {
  // Six pages: more than the phone's bar holds.
  test.use({ storageState: STORAGE.admin });

  test("Today, with nothing for the admin yet, leads to their next page", async ({
    page,
  }) => {
    await page.goto("/today");
    await page
      .getByRole("link", {
        name: today.empty.next.replace("{page}", nav.departments),
      })
      .click();
    await expect(page).toHaveURL("/departments");
  });

  // A 320 px phone, and a 390 px one at 200% text, which lays out in 195 CSS px (UX review 1).
  for (const width of [320, 195]) {
    test(`at ${width} px every tab and header control is on screen and 44 px wide, and no page scrolls sideways`, async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "the desktop has the sidebar");
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/today");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        today.title,
      );
      const bar = tabBar(page);
      await expect(bar.getByRole("link", { name: nav.today })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Fewer tabs when five do not fit; the rest are under More.
      await expect(bar.getByRole("button", { name: shell.more })).toBeVisible();
      expect(await cramped(bar, width)).toEqual([]);
      expect(await cramped(page.getByRole("banner"), width)).toEqual([]);
      expect(await sideways(page)).toBe(0);

      await page.goto("/people");
      await expect(
        page.getByRole("heading", { level: 1, name: nav.people }),
      ).toBeVisible();
      expect(await sideways(page)).toBe(0);
      await page.getByRole("link", { name: demoAccounts.trainer.name }).click();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: demoAccounts.trainer.name,
        }),
      ).toBeVisible();
      expect(await sideways(page)).toBe(0);

      await page.goto("/settings?group=security");
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
      expect(await sideways(page)).toBe(0);
    });
  }
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
