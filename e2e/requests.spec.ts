import { randomUUID } from "node:crypto";
import type { Browser, Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { defaultRoles, portfolioAxes } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { type DemoAccount, demoTrainers } from "../db/seed/demo/people.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { findCollegeId } from "../src/modules/org/index.ts";
import { getSetting, settingsRegistry } from "../src/modules/settings/index.ts";
import {
  activeTerm,
  calendarOf,
  calendarSettings,
  nextDueDay,
} from "../src/modules/terms/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { wallClock } from "../src/platform/i18n/time-zone.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { modelledPerson } from "./support/model.ts";
import { signedIn } from "./support/pages.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { requests: text, readiness: board, pages, nav } = messages;
const locale = `ar-u-nu-${settingsRegistry["locale.digits"].default}`;
const t = createTranslator({ locale, messages, namespace: "requests" });
const r = createTranslator({ locale, messages, namespace: "readiness" });
const framework = createTranslator({
  locale,
  messages,
  namespace: "framework",
});
const electrical = demoDepartments[1].name;
// Tests that read or write the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The trainer's role, and Electrical's trainers: the cast's and the demo accounts that train there.
const trainer =
  defaultRoles.find(({ key }) => key === "trainer")?.labels.ar ?? "";
const accounts: DemoAccount[] = Object.values(demoAccounts);
const trainers =
  demoTrainers[1].length +
  accounts.filter(({ roles }) =>
    roles.some(
      (role) =>
        "key" in role &&
        role.key === "trainer" &&
        role.department === electrical,
    ),
  ).length;
// Training practices, the axis a request for attendance sheets counts under.
const practices = framework("axisOption", {
  code: "6",
  title:
    portfolioAxes.flatMap(({ axes }) => axes).find(({ code }) => code === "6")
      ?.title ?? "",
});

// A day as the sheet's day field writes it, and as the list of requests does.
const dayIn = (style: Intl.DateTimeFormatOptions) => (day: string) =>
  new Intl.DateTimeFormat(locale, { ...style, timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
const short = dayIn({ month: "short", day: "numeric", year: "numeric" });
const full = dayIn({ dateStyle: "full" });

// The day the sheet starts on, as the page reckons it from the demo term's calendar on the
// college's clock: this week's due day, or the next week's once it has passed (lead review D,
// proposal 4).
async function startDay() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  try {
    const collegeId = await findCollegeId(db);
    if (!collegeId) throw new Error("e2e: the demo college is missing");
    const [term, settings, timeZone] = await Promise.all([
      activeTerm(collegeId, db),
      calendarSettings(collegeId, db),
      getSetting("locale.timeZone", { collegeId }, db),
    ]);
    if (!term) throw new Error("e2e: the demo term is not active");
    const day = nextDueDay(
      calendarOf(term, term.events, settings, term.breaks),
      wallClock(new Date(), timeZone).slice(0, 10),
    );
    if (!day) throw new Error("e2e: the demo term has no due day left");
    return day;
  } finally {
    await pool.end();
  }
}

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

test("the head of Electrical sends a quick request to all of the department's trainers in under 30 seconds of a head's time by the keystroke-level model, which then lists it with whom it reached (Step 22; lead review D, M4)", async ({
  browser,
  hasTouch,
}) => {
  // The Done-when's 12 trainers are a department's, the owner's answer: Electrical's, all of them.
  expect(trainers).toBeGreaterThanOrEqual(12);
  // The sending has 30 s of its own, timed below; signing in and the checks after it take more.
  test.setTimeout(120_000);
  const page = await asHead(browser);
  const title = `كشوف الحضور ${Date.now()}`;
  const sheet = page.getByRole("dialog", { name: text.new.title });
  const head = modelledPerson((label, option) =>
    choose(page, sheet, label, option, hasTouch),
  );

  const started = Date.now();
  await page.goto("/requests");
  await head.click(page.getByRole("button", { name: text.new.button }));
  // The sheet opens on its first field, its day already the coming due day (proposal 4).
  const field = sheet.getByLabel(text.new.fields.title);
  await expect(field).toBeFocused();
  await head.type(field, title);
  await head.choose(text.new.fields.axis, practices);
  await head.choose(text.new.fields.targets, text.new.role);
  await head.choose(text.new.fields.role, trainer);
  await head.click(sheet.getByRole("button", { name: text.new.submit }));
  await expect(
    page.getByText(t("new.sent", { count: trainers })),
  ).toBeVisible();
  // A head's time by the model is within the step's 30 seconds; the scripted run has a bound of its
  // own that it can fail.
  test.info().annotations.push({
    type: "modelled time",
    description: `${head.seconds().toFixed(1)} seconds`,
  });
  expect(head.seconds()).toBeLessThan(30);
  expect(Date.now() - started).toBeLessThan(30_000);

  await expect(sheet).toBeHidden();
  const sent = page
    .getByRole("region", { name: text.list })
    .getByRole("listitem")
    .filter({ hasText: title });
  await expect(sent).toContainText(
    t("targets.role", { role: trainer, place: electrical }),
  );
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
  await expect(
    sheet.getByRole("checkbox", { name: text.new.allShown, exact: true }),
  ).toBeVisible();
  if (hasTouch) expect(await smallTargets(sheet)).toEqual([]);
  expect(await seriousViolations(page)).toEqual([]);
  await page.context().close();
});

test(
  "the sheet starts on this week's due day, or the next week's once it has passed, and ticks at once everyone its search shows, keeping those it hides (lead review D, proposal 4)",
  DATABASE,
  async ({ browser, hasTouch }) => {
    const day = await startDay();
    const page = await asHead(browser);
    const title = `جدول مراقبة الاختبارات ${Date.now()}`;
    await page.goto("/requests");
    await page.getByRole("button", { name: text.new.button }).click();
    const sheet = page.getByRole("dialog", { name: text.new.title });
    await expect(
      sheet.getByRole("button", {
        name: `${text.new.fields.due}: ${short(day)}`,
        exact: true,
      }),
    ).toBeVisible();
    await sheet.getByLabel(text.new.fields.title).fill(title);
    await choose(
      page,
      sheet,
      text.new.fields.targets,
      text.new.people,
      hasTouch,
    );
    const list = sheet.getByRole("list", {
      name: t("new.listLabel", { place: electrical }),
    });
    const boxes = list.getByRole("checkbox");
    const box = (number: string) =>
      list
        .getByRole("listitem")
        .filter({ hasText: number })
        .getByRole("checkbox");
    const all = sheet.getByRole("checkbox", {
      name: text.new.allShown,
      exact: true,
    });
    const search = sheet.getByRole("searchbox", {
      name: t("new.search", { place: electrical }),
    });
    const chosen = (count: number) =>
      expect(sheet.getByText(t("new.chosen", { count }))).toBeVisible();
    const everyone = await boxes.count();
    expect(everyone).toBeGreaterThan(12);
    const [first, second, ...rest] = demoTrainers[1];

    // A search that shows one: ticking all ticks that one alone.
    await search.fill(first);
    await expect(boxes).toHaveCount(1);
    await all.click();
    await expect(box(first)).toBeChecked();
    await chosen(1);
    // The whole list again: the box is unticked while some are not, and ticks the rest, the first
    // counted once.
    await search.fill("");
    await expect(boxes).toHaveCount(everyone);
    await expect(all).not.toBeChecked();
    await all.click();
    await expect(all).toBeChecked();
    await chosen(everyone);
    // A search that shows another, ticked: unticking all unticks that one alone.
    await search.fill(second);
    await expect(boxes).toHaveCount(1);
    await expect(all).toBeChecked();
    await all.click();
    await search.fill("");
    await expect(box(second)).not.toBeChecked();
    await expect(box(first)).toBeChecked();
    await chosen(everyone - 1);
    // Twelve of them, as a head picks a group: as many more taken out.
    for (const number of rest.slice(0, everyone - 13)) {
      await box(number).click();
    }
    await chosen(12);

    await sheet.getByRole("button", { name: text.new.submit }).click();
    await expect(page.getByText(t("new.sent", { count: 12 }))).toBeVisible();
    const sent = page
      .getByRole("region", { name: text.list })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(sent).toContainText(t("targets.people", { count: 12 }));
    await expect(sent).toContainText(t("item.due", { date: full(day) }));
    await page.context().close();
  },
);

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
  await choose(page, sheet, text.new.fields.targets, text.new.role, hasTouch);
  await submit.click();
  await expect(sheet.getByRole("alert")).toHaveText(text.new.required.role);
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

// The pages a viewer's board links, the term's page under one name.
const linked = async (page: Page) =>
  (
    await page
      .locator("main")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
  ).map((href) => href?.replace(/^\/terms\/.+$/, "/terms/…"));

test("the board links each row only where its viewer opens the page: the dean the term and the framework alone, and the vice-dean each department's plan as well, which they read and do not change (lead review D, M5 and proposal 3)", async ({
  browser,
}) => {
  const dean = await signedIn(browser, {
    identifier: demoAccounts.dean.employeeNumber,
    password: demo.password,
  });
  await dean.goto("/readiness");
  await expect(
    dean.getByRole("heading", { level: 1, name: board.title }),
  ).toBeVisible();
  // The term's row, the framework's and the tasks', whose page is the framework's.
  expect(new Set(await linked(dean))).toEqual(
    new Set(["/terms/…", "/framework"]),
  );
  // Whom the rows without a link wait on is still named.
  await expect(
    dean
      .getByRole("region", { name: board.college })
      .getByRole("listitem")
      .filter({ hasText: board.rows.people.title }),
  ).toContainText(r("owners", { names: demoAccounts.admin.name }));
  for (const href of new Set(
    await dean
      .locator("main")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  )) {
    await dean.goto(href ?? "/");
    await expect(dean.getByText(pages.forbidden.title)).toHaveCount(0);
  }
  await dean.context().close();

  const viceDean = await signedIn(browser, {
    identifier: demoAccounts.viceDean.employeeNumber,
    password: demo.password,
  });
  await viceDean.goto("/readiness");
  const hrefs = await linked(viceDean);
  expect(hrefs).not.toContain("/people");
  expect(hrefs).toContain("/rayat");
  expect(
    hrefs.filter((href) => href?.startsWith("/plan?department=")),
  ).toHaveLength(demoDepartments.length);
  await viceDean
    .getByRole("link", {
      name: r("openLabel", {
        title: r("rows.plan.title", { department: electrical }),
      }),
    })
    .click();
  await viceDean.waitForURL(/\/plan\?department=/);
  await expect(
    viceDean.getByRole("heading", { level: 1, name: messages.plan.title }),
  ).toBeVisible();
  await expect(viceDean.getByText(pages.forbidden.title)).toHaveCount(0);
  // Electrical's published plan, read: nothing on it edits, publishes or starts a version.
  for (const name of [
    messages.plan.add,
    messages.plan.publish,
    messages.plan.start,
  ]) {
    await expect(viceDean.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(
    viceDean.getByRole("button", {
      name: new RegExp(`^${messages.plan.newVersion.split("{")[0]}`),
    }),
  ).toHaveCount(0);
  await viceDean.context().close();
});

// The pages of what others have done since read again when a step back in the browser shows them:
// Next.js shows the page as it was drawn, kept hidden or in its cache, and asks the server for
// nothing (lead review D). The words the college gives a page's description, set meanwhile, are the
// change each must show.
const RETURNS = [
  {
    path: "/readiness",
    key: "readiness.description",
    words: board.description,
  },
  { path: "/requests", key: "requests.description", words: text.description },
  {
    path: "/console",
    key: "console.description",
    words: messages.console.description,
    admin: true,
  },
  {
    path: "/system",
    key: "system.description",
    words: messages.system.description,
    admin: true,
  },
];

// The vice-dean on a session of their own, or the admin on the shared one, which only reads here.
const viewerOf = async (browser: Browser, admin = false) =>
  admin
    ? (await browser.newContext({ storageState: STORAGE.admin })).newPage()
    : signedIn(browser, {
        identifier: demoAccounts.viceDean.employeeNumber,
        password: demo.password,
      });
const sidebarOf = (page: Page) =>
  page
    .locator("aside")
    .getByRole("navigation", { name: messages.shell.navigation });
// The words the college gives a message, until the test puts them back.
const OVERRIDE = `insert into text_overrides (college_id, key, value)
  select id, $1, $2 from colleges
  on conflict (college_id, key) do update set value = excluded.value`;
const databaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  return url;
};

for (const { path, key, words, admin } of RETURNS) {
  test(
    `${path} reads again when a step back in the browser shows it, so it never shows the past (lead review D)`,
    DATABASE,
    async ({ browser, isMobile }) => {
      test.skip(isMobile, "a phone has the tab bar");
      const { pool } = createDb(databaseUrl());
      const reworded = `${words} (${randomUUID().slice(0, 8)})`;
      const viewer = await viewerOf(browser, admin);
      try {
        await viewer.goto(path);
        await expect(viewer.getByText(words)).toBeVisible();
        await sidebarOf(viewer).getByRole("link", { name: nav.today }).click();
        await viewer.waitForURL(/\/today/);
        await pool.query(OVERRIDE, [key, reworded]);
        await viewer.goBack();
        await viewer.waitForURL(new RegExp(path));
        await expect(viewer.getByText(reworded)).toBeVisible();
      } finally {
        await pool.query("delete from text_overrides where key = $1", [key]);
        await pool.end();
        await viewer.context().close();
      }
    },
  );
}

test(
  "the board reads again when the browser goes back to it past other pages, and a link back to it asks the server once (lead review D)",
  DATABASE,
  async ({ browser, isMobile }) => {
    test.skip(isMobile, "a phone has the tab bar");
    const { pool } = createDb(databaseUrl());
    const key = "readiness.description";
    const [first, second] = [1, 2].map(
      () => `${board.description} (${randomUUID().slice(0, 8)})`,
    );
    const viewer = await viewerOf(browser);
    const sidebar = sidebarOf(viewer);
    try {
      await viewer.goto("/readiness");
      await expect(viewer.getByText(board.description)).toBeVisible();
      // Five pages on, Next.js no longer keeps the board hidden: back there, it draws it from its cache.
      for (const name of [
        nav.today,
        nav.requests,
        nav.framework,
        nav.terms,
        nav.plan,
      ]) {
        const link = sidebar.getByRole("link", { name, exact: true });
        const href = (await link.getAttribute("href")) ?? "";
        await link.click();
        await viewer.waitForURL((url) => url.pathname === href);
      }
      await pool.query(OVERRIDE, [key, first]);
      for (let step = 0; step < 5; step++) await viewer.goBack();
      await viewer.waitForURL(/\/readiness/);
      await expect(viewer.getByText(first)).toBeVisible();

      // A link back fetches the board itself, and nothing asks for it again.
      await sidebar.getByRole("link", { name: nav.today }).click();
      await viewer.waitForURL(/\/today/);
      await pool.query(OVERRIDE, [key, second]);
      const asked: string[] = [];
      viewer.on("request", (request) => {
        const { pathname, searchParams } = new URL(request.url());
        const headers = request.headers();
        if (
          pathname === "/readiness" &&
          searchParams.has("_rsc") &&
          !headers["next-router-prefetch"] &&
          !headers["next-router-segment-prefetch"]
        ) {
          asked.push(request.url());
        }
      });
      await sidebar.getByRole("link", { name: nav.readiness }).click();
      await viewer.waitForURL(/\/readiness/);
      await expect(viewer.getByText(second)).toBeVisible();
      // What the page would ask after it shows, it asks at once: a second is ample to see none.
      await viewer.waitForTimeout(1000);
      expect(asked).toHaveLength(1);
    } finally {
      await pool.query("delete from text_overrides where key = $1", [key]);
      await pool.end();
      await viewer.context().close();
    }
  },
);

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
