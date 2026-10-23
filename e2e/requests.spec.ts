import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { demoTrainers } from "../db/seed/demo/people.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { requests: text, readiness: board, pages, nav } = messages;
const locale = `ar-u-nu-${settingsRegistry["locale.digits"].default}`;
const t = createTranslator({ locale, messages, namespace: "requests" });
const r = createTranslator({ locale, messages, namespace: "readiness" });
const electrical = demoDepartments[1].name;

const asHead = (browser: Parameters<typeof signedIn>[0]) =>
  signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );

// A choice from one of the sheet's lists, by a finger on a phone.
async function choose(
  page: Page,
  sheet: Locator,
  label: string,
  option: string,
  hasTouch: boolean,
) {
  await sheet.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  const choice = page.getByRole("option", { name: option, exact: true });
  if (hasTouch) await choice.tap();
  else await choice.click();
}

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("the head of Electrical sends a quick request to twelve of its trainers in under 30 seconds, which then lists it with whom it reached (Step 22)", async ({
  browser,
  hasTouch,
}) => {
  // The sending has 30 s of its own, timed below; signing in and the checks after it take more.
  test.setTimeout(120_000);
  const page = await asHead(browser);
  const title = `كشوف الحضور ${Date.now()}`;
  // Twelve of the department's trainers, by the employee numbers their lines show.
  const twelve = demoTrainers[1].slice(1, 13);

  const started = Date.now();
  await page.goto("/requests");
  await page.getByRole("button", { name: text.new.button }).click();
  const sheet = page.getByRole("dialog", { name: text.new.title });
  await sheet.getByLabel(text.new.fields.title).fill(title);
  // Due today, a day of the demo term's ninth week.
  await sheet
    .getByRole("button", { name: new RegExp(`^${text.new.fields.due}`) })
    .click();
  await page.locator('[role="grid"] button[aria-current="date"]').click();
  await choose(page, sheet, text.new.fields.targets, text.new.people, hasTouch);
  const list = sheet.getByRole("list", {
    name: t("new.listLabel", { place: electrical }),
  });
  for (const number of twelve) {
    await list
      .getByRole("listitem")
      .filter({ hasText: number })
      .getByRole("checkbox")
      .click();
  }
  await expect(sheet.getByText(t("new.chosen", { count: 12 }))).toBeVisible();
  await sheet.getByRole("button", { name: text.new.submit }).click();
  await expect(page.getByText(t("new.sent", { count: 12 }))).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);

  await expect(sheet).toBeHidden();
  const sent = page
    .getByRole("region", { name: text.list })
    .getByRole("listitem")
    .filter({ hasText: title });
  await expect(sent).toContainText(t("targets.people", { count: 12 }));
  await expect(sent).toContainText(text.item.evidence);
  await expect(sent).toContainText(demoAccounts.head.name);
  // Axe reads the page with its Arabic made Latin: the list last, then the sheet on a fresh page.
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) {
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    expect(await sideways(page)).toBe(false);
  }
  await page.reload();
  await page.getByRole("button", { name: text.new.button }).click();
  await choose(page, sheet, text.new.fields.targets, text.new.people, hasTouch);
  await expect(list.getByRole("checkbox").first()).toBeVisible();
  if (hasTouch) expect(await smallTargets(sheet)).toEqual([]);
  expect(await seriousViolations(page)).toEqual([]);
  await page.context().close();
});

test("the head is told what the sheet still needs before it sends anything (Step 22)", async ({
  browser,
  hasTouch,
}) => {
  const page = await asHead(browser);
  await page.goto("/requests");
  await page.getByRole("button", { name: text.new.button }).click();
  const sheet = page.getByRole("dialog", { name: text.new.title });
  const submit = sheet.getByRole("button", { name: text.new.submit });
  await submit.click();
  await expect(sheet.getByRole("alert")).toHaveText(text.new.required.title);
  await sheet.getByLabel(text.new.fields.title).fill("طلب ناقص");
  await submit.click();
  await expect(sheet.getByRole("alert")).toHaveText(text.new.required.due);
  await sheet
    .getByRole("button", { name: new RegExp(`^${text.new.fields.due}`) })
    .click();
  await page.locator('[role="grid"] button[aria-current="date"]').click();
  await choose(page, sheet, text.new.fields.targets, text.new.people, hasTouch);
  await submit.click();
  await expect(sheet.getByRole("alert")).toHaveText(text.new.required.people);
  await page.context().close();
});

test("the vice-dean sees each of the term's responsibilities with its state, whom it waits on and its page; the head of Electrical sees the college's and their own department's plan alone (Step 22)", async ({
  browser,
  hasTouch,
}) => {
  const viceDean = await signedIn(browser, {
    identifier: demoAccounts.viceDean.employeeNumber,
    password: demo.password,
  });
  await viceDean.goto("/readiness");
  await expect(
    viceDean.getByRole("heading", { level: 1, name: board.title }),
  ).toBeVisible();
  const college = viceDean.getByRole("region", { name: board.college });
  await expect(college.getByRole("heading", { level: 3 })).toHaveText(
    (["term", "framework", "people", "rayat", "matched", "tasks"] as const).map(
      (id) => board.rows[id].title,
    ),
  );
  // The vice-dean publishes the framework, from its page.
  const framework = college
    .getByRole("listitem")
    .filter({ hasText: board.rows.framework.title });
  await expect(framework).toContainText(
    r("owners", { names: demoAccounts.viceDean.name }),
  );
  await expect(framework).toContainText(board.states.done);
  await expect(
    framework.getByRole("link", {
      name: r("openLabel", { title: board.rows.framework.title }),
    }),
  ).toHaveAttribute("href", "/framework");
  // Every department's plan, in the college's order.
  const plans = viceDean.getByRole("region", { name: board.plans });
  await expect(plans.getByRole("heading", { level: 3 })).toHaveCount(
    demoDepartments.length,
  );
  await expect(
    plans.getByRole("heading", {
      name: r("rows.plan.title", { department: electrical }),
    }),
  ).toBeVisible();
  expect(await seriousViolations(viceDean)).toEqual([]);
  if (hasTouch) {
    expect(await smallTargets(viceDean.locator("main"))).toEqual([]);
    expect(await sideways(viceDean)).toBe(false);
  }
  await viceDean.context().close();

  const head = await asHead(browser);
  await head.goto("/readiness");
  await expect(
    head
      .getByRole("region", { name: board.plans })
      .getByRole("heading", { level: 3 }),
  ).toHaveText([r("rows.plan.title", { department: electrical })]);
  await expect(
    head.getByRole("region", { name: board.college }).getByRole("listitem"),
  ).toHaveCount(6);
  await head.context().close();
});

test.describe("without the keys", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the quick requests and the readiness board, and the shell offers neither", async ({
    page,
  }) => {
    for (const path of ["/requests", "/readiness"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: pages.forbidden.title }),
      ).toBeVisible();
    }
    for (const name of [nav.requests, nav.readiness]) {
      await expect(page.getByRole("link", { name })).toHaveCount(0);
    }
  });
});
