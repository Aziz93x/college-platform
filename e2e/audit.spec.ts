import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { defaultRoles } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { demoSettings } from "../db/seed/demo/settings.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { wallClock } from "../src/platform/i18n/time-zone.ts";
import { test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { confirmIfAsked, open } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { audit, nav, shell, pages, people } = messages;
const [, electrical] = demoDepartments.map(({ name }) => name);
const headRole = defaultRoles.find(({ key }) => key === "head")?.labels.ar;
// Tests that write to the log, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The log belongs to whoever holds audit.view: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

const events = (page: Page) => page.locator("main ol > li");

test("the admin narrows the log to a person, an action and today, and opens an event's details", async ({
  page,
}) => {
  await open(page, "/audit");
  await page
    .getByLabel(audit.filters.search, { exact: true })
    .fill(demoAccounts.trainer.name);
  const action = page.getByRole("combobox", { name: audit.filters.action });
  await action.fill(audit.actions.session.signIn);
  await page
    .getByRole("option", { name: audit.actions.session.signIn })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^${audit.filters.period}`) })
    .click();
  // Today, as both ends of the period: the demo trainer signed in today (e2e/auth.setup.ts).
  const today = page.locator('[role="grid"] button[aria-current="date"]');
  await today.click();
  await today.click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: audit.filters.apply }).click();

  const day = wallClock(new Date(), demoSettings["locale.timeZone"]).slice(
    0,
    10,
  );
  await expect(page).toHaveURL(
    `/audit?${new URLSearchParams({
      from: day,
      to: day,
      action: "session.signIn",
      q: demoAccounts.trainer.name,
    })}`,
  );
  await expect(events(page).first()).toBeVisible();
  for (const text of await events(page).allInnerTexts()) {
    expect(text).toContain(audit.actions.session.signIn);
    expect(text).toContain(demoAccounts.trainer.name);
  }

  const first = events(page).first();
  await first.getByRole("button").click();
  await expect(first.getByText(audit.address, { exact: true })).toBeVisible();
  await expect(first.getByText(audit.device, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: audit.filters.clear }).click();
  await expect(page).toHaveURL("/audit");
});

test("a search that finds no one shows the empty log, with a way back to all of it", async ({
  page,
}) => {
  await page.goto(`/audit?${new URLSearchParams({ q: "zzzz" })}`);
  await expect(
    page.getByRole("heading", { name: audit.empty.title }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: audit.filters.clear })
    .last()
    .click();
  await expect(page).toHaveURL("/audit");
  await expect(events(page).first()).toBeVisible();
});

test("the log pages back through older events and returns to the newest", async ({
  page,
}) => {
  await page.goto("/audit");
  const newest = await events(page).first().innerText();
  await page.getByRole("link", { name: audit.older }).click();
  await expect(page).toHaveURL(/after=/);
  await expect(events(page).first()).not.toHaveText(newest);
  await page.getByRole("link", { name: audit.newest }).click();
  await expect(page).toHaveURL("/audit");
});

test(
  "the export downloads what the filters select, as a CSV a spreadsheet opens in Arabic, and is itself in the log",
  DATABASE,
  async ({ page }) => {
    await page.goto("/audit?action=account.create");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: audit.export }).click();
    const file = await download;
    const text = await readFile((await file.path()) ?? "", "utf8");
    expect(text.startsWith("\uFEFF")).toBe(true);
    const [header, ...rows] = text.slice(1).trimEnd().split("\r\n");
    expect(header.split(",")).toEqual([
      ...Object.values(audit.columns),
      audit.address,
      audit.device,
    ]);
    // Every person the demo added has their own row.
    expect(rows.length).toBeGreaterThanOrEqual(46);
    for (const row of rows) {
      expect(row).toContain(audit.actions.account.create);
    }

    // Its name, in Arabic; a browser saves it so where the system's locale can write it.
    const response = await page.request.get(
      "/audit/export?action=account.create",
    );
    expect(response.headers()["content-disposition"]).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent(audit.exportFile)}`,
    );

    // Tests running beside this one add to the log, so it reads the exports only.
    await page.goto("/audit?action=audit.export");
    await expect(events(page).first()).toContainText(
      audit.actions.audit.export,
    );
  },
);

// Pages back through a record's history until it shows the text: other tests add to it.
async function historyShows(page: Page, text: string) {
  const history = page.getByRole("region", { name: audit.history.title });
  await expect(async () => {
    if (!(await history.innerText()).includes(text)) {
      await history.getByRole("link", { name: audit.history.older }).click();
    }
    await expect(history).toContainText(text, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
}

test("a person's page, a role's and a department's show their history, by name", async ({
  page,
}) => {
  await open(page, "/people");
  await page.getByRole("link", { name: demoAccounts.head.name }).click();
  await historyShows(page, audit.actions.account.enableTwoFactor);

  await page.goto("/roles");
  await page.getByRole("link", { name: headRole }).click();
  await historyShows(
    page,
    `${demoAccounts.head.name}: ${headRole} · ${electrical}`,
  );

  await page.goto("/departments");
  await page.getByRole("link", { name: electrical }).click();
  await historyShows(page, audit.actions.department.create);
});

test(
  "a change shows at the top of the record's history, with what it was before",
  DATABASE,
  async ({ page, account }) => {
    const person = await account();
    const renamed = `${person.name} 2`;
    await open(page, `/people/${person.userId}`);
    await page.getByLabel(people.person.name, { exact: true }).fill(renamed);
    await page
      .getByRole("button", { name: people.person.edit.save, exact: true })
      .click();
    await confirmIfAsked(
      page,
      page.getByText(people.person.edit.saved.replace("{name}", renamed)),
      demo.adminPassword,
    );
    const latest = page
      .getByRole("region", { name: audit.history.title })
      .locator("ol > li")
      .first();
    await expect(latest).toContainText(audit.actions.person.update);
    // The keyboard opens the row: the saved toast can sit over it, and a toast waits while it is
    // hovered, so with the pointer left on the toast a click would wait until the test times out.
    // What changed is in the row while it is closed too, so its state shows that it opened.
    const row = latest.getByRole("button");
    await row.press("Enter");
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(latest.locator("del")).toHaveText(person.name);
    await expect(latest.locator("ins")).toHaveText(renamed);
  },
);

test("the sidebar groups the administration pages and folds to its icon rail, as the admin left it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a phone has the tab bar");
  await page.goto("/audit");
  const sidebar = page.locator("aside");
  const navigation = sidebar.getByRole("navigation", {
    name: shell.navigation,
  });
  await expect(
    navigation
      .getByRole("list", { name: nav.groups.administration })
      .getByRole("link"),
  ).toHaveText([
    nav.departments,
    nav.roles,
    nav.people,
    nav.settings,
    nav.audit,
    nav.axes,
  ]);

  await sidebar.getByRole("button", { name: shell.sidebar.collapse }).click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect
    .poll(() => sidebar.evaluate((node) => node.getBoundingClientRect().width))
    .toBeLessThan(80);
  // Each icon on the rail still names its page.
  await expect(
    navigation.getByRole("link", { name: nav.audit }),
  ).toHaveAttribute("title", nav.audit);

  await page.reload();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.locator("main").click();
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(
    sidebar.getByRole("button", { name: shell.sidebar.collapse }),
  ).toBeVisible();
});

test("on a phone, the admin's eleven pages leave four tabs and More, whose sheet opens the rest", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the desktop has the sidebar");
  await page.goto("/today");
  const bar = page.getByRole("navigation", { name: shell.navigation });
  await expect(bar.getByRole("link")).toHaveText([
    nav.today,
    nav.departments,
    nav.roles,
    nav.people,
  ]);
  await bar.getByRole("button", { name: shell.more }).click();
  const sheet = page.getByRole("dialog", { name: shell.moreTitle });
  await expect(sheet.getByRole("link")).toHaveText([
    nav.settings,
    nav.audit,
    nav.axes,
    nav.terms,
    nav.framework,
    nav.rayat,
    nav.announcements,
  ]);
  await sheet.getByRole("link", { name: nav.audit }).click();
  await expect(page).toHaveURL("/audit");
  await expect(sheet).toBeHidden();
});

test.describe("without the log's key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("the log and its export answer with the refusal, and the shell offers no log", async ({
    page,
  }) => {
    await page.goto("/audit");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
    expect((await page.request.get("/audit/export")).status()).toBe(403);
    await expect(page.getByRole("link", { name: nav.audit })).toHaveCount(0);
  });
});

test("the log and a record's history have no serious accessibility issue", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/audit");
  await events(page).first().getByRole("button").click();
  expect(await seriousViolations(page)).toEqual([]);
  await open(page, "/people");
  const head = await page
    .getByRole("link", { name: demoAccounts.head.name })
    .getAttribute("href");
  await open(page, head ?? "");
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control of the log has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/audit");
    await events(page).first().getByRole("button").click();
    // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
    await page.evaluate(() =>
      document.querySelector("nextjs-portal")?.remove(),
    );
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });
});
