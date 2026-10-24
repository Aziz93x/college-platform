import { randomUUID } from "node:crypto";
import type { Browser, Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { defaultRoles, portfolioAxes } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import {
  type DemoAccount,
  demoHeads,
  demoTrainers,
} from "../db/seed/demo/people.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { holdersIn } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { remindOwners } from "../src/modules/readiness/index.ts";
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
const mechanical = demoDepartments[2].name;
// Tests that read or write the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The trainer's role, and Mechanical's trainers: the cast's and the demo accounts that train there.
// The demo trainer, whose bell the notification tests read empty, is Electrical's (Audit 4).
const trainer =
  defaultRoles.find(({ key }) => key === "trainer")?.labels.ar ?? "";
const accounts: DemoAccount[] = Object.values(demoAccounts);
const trainers =
  demoTrainers[2].length +
  accounts.filter(({ roles }) =>
    roles.some(
      (role) =>
        "key" in role &&
        role.key === "trainer" &&
        role.department === mechanical,
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

// A head of department, with the code every demo head's authenticator gives: Electrical's, or
// another by employee number.
const asHead = (
  browser: Parameters<typeof signedIn>[0],
  identifier = demoAccounts.head.employeeNumber,
) =>
  signedIn(
    browser,
    { identifier, password: demo.password },
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

test("the head of Mechanical sends a quick request to all of the department's trainers in under 30 seconds of a head's time by the keystroke-level model, which then lists it with whom it reached (Step 22; lead review D, M4)", async ({
  browser,
  hasTouch,
}) => {
  // The Done-when's 12 trainers are a department's, the owner's answer: Mechanical's, all of them.
  expect(trainers).toBeGreaterThanOrEqual(12);
  // The sending has 30 s of its own, timed below; signing in and the checks after it take more.
  test.setTimeout(120_000);
  const page = await asHead(browser, demoHeads[2]);
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
    t("targets.role", { role: trainer, place: mechanical }),
  );
  await expect(sent).toContainText(text.item.evidence);
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
    expect(everyone).toBeGreaterThanOrEqual(14);
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
    // Twelve of them, as a head picks a group: as many more taken out, the demo trainer among them,
    // whose bell the notification tests read empty (Audit 4).
    for (const number of [
      demoAccounts.trainer.employeeNumber,
      ...rest.slice(0, everyone - 14),
    ]) {
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
    await expect(sent).toContainText(demoAccounts.head.name);
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
  await expect(
    viceDean.getByRole("region", { name: board.plans }),
  ).toBeVisible();
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
// change each must show; the board's are reworded by three tests.
const BOARD_WORDS = "readiness.description";
const RETURNS: {
  path: string;
  key: string;
  words: string;
  admin?: boolean;
  /** In a browser without the Navigation API, which hears the step from popstate alone. */
  bare?: boolean;
}[] = [
  { path: "/readiness", key: BOARD_WORDS, words: board.description },
  {
    path: "/readiness",
    key: BOARD_WORDS,
    words: board.description,
    bare: true,
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
// The words the college gives a message, until the test puts them back. Tests that reword the same
// message take its lock, as the suite runs fully parallel: none then writes or deletes the words
// another is waiting to read.
const OVERRIDE = `insert into text_overrides (college_id, key, value)
  select id, $1, $2 from colleges
  on conflict (college_id, key) do update set value = excluded.value`;
const databaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  return url;
};

for (const { path, key, words, admin, bare } of RETURNS) {
  test(
    `${path} reads again when a step back in the browser shows it, so it never shows the past${bare ? ", where the browser has no Navigation API" : ""} (lead review D)`,
    { ...DATABASE, lock: key },
    async ({ browser, isMobile }) => {
      test.skip(isMobile, "a phone has the tab bar");
      const { pool } = createDb(databaseUrl());
      const reworded = `${words} (${randomUUID().slice(0, 8)})`;
      const viewer = await viewerOf(browser, admin);
      if (bare) {
        await viewer.context().addInitScript(() => {
          Object.defineProperty(window, "navigation", {
            value: undefined,
            configurable: true,
          });
        });
      }
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
  { ...DATABASE, lock: BOARD_WORDS },
  async ({ browser, isMobile }) => {
    test.skip(isMobile, "a phone has the tab bar");
    const { pool } = createDb(databaseUrl());
    const key = BOARD_WORDS;
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

// A long press on the back button steps over several entries at once, here from the board to an
// earlier visit of it: the page stays shown throughout, so only hearing the step reads it again.
for (const bare of [false, true]) {
  test(
    `the board reads again when a step of two entries goes back to an earlier visit of it${bare ? ", where the browser has no Navigation API" : ""} (lead review D)`,
    { ...DATABASE, lock: BOARD_WORDS },
    async ({ browser, isMobile }) => {
      test.skip(isMobile, "a phone has the tab bar");
      const { pool } = createDb(databaseUrl());
      const reworded = `${board.description} (${randomUUID().slice(0, 8)})`;
      const viewer = await viewerOf(browser);
      if (bare) {
        await viewer.context().addInitScript(() => {
          Object.defineProperty(window, "navigation", {
            value: undefined,
            configurable: true,
          });
        });
      }
      const sidebar = sidebarOf(viewer);
      try {
        await viewer.goto("/readiness");
        await expect(viewer.getByText(board.description)).toBeVisible();
        for (const [name, path] of [
          [nav.today, /\/today/],
          [nav.readiness, /\/readiness/],
        ] as const) {
          await sidebar.getByRole("link", { name }).click();
          await viewer.waitForURL(path);
        }
        await expect(viewer.getByText(board.description)).toBeVisible();
        await pool.query(OVERRIDE, [BOARD_WORDS, reworded]);
        await viewer.evaluate(() => history.go(-2));
        await expect(viewer.getByText(reworded)).toBeVisible();
        // The step went back two entries: the next one is Today's.
        await viewer.goForward();
        await viewer.waitForURL(/\/today/);
      } finally {
        await pool.query("delete from text_overrides where key = $1", [
          BOARD_WORDS,
        ]);
        await pool.end();
        await viewer.context().close();
      }
    },
  );
}

// The board reaches the owners of its open rows (lead review D, proposal 5): whoever sees a row
// reminds them, once a day each, and the reminder opens the row's page; the console lists the open
// rows its viewer owns. The demo's vice-dean reminded the admin of the matched row today already.
test(
  "whoever sees an open row reminds its owners once a day, the reminder opens its page, and the console lists the admin's open rows (lead review D, proposal 5)",
  DATABASE,
  async ({ browser, isMobile }) => {
    test.skip(
      isMobile,
      "a row's owners are reminded once a day: one project reminds them",
    );
    const { db, pool } = createDb(databaseUrl());
    const collegeId = (await findCollegeId(db)) ?? "";
    const generalStudies = demoDepartments[0].name;
    const [{ id: departmentId }] = (
      await pool.query("select id from departments where name = $1", [
        generalStudies,
      ])
    ).rows;
    const publishers =
      (await holdersIn(collegeId, [departmentId], "plan.publish", db)).get(
        departmentId,
      ) ?? [];
    // General Studies' plan unreminded today, as the demo leaves it, should a retry come after.
    await pool.query(
      "delete from notifications where kind = 'readinessReminder' and once_key like $1",
      [`readiness:%:plan:${departmentId}:%`],
    );
    const term = await activeTerm(collegeId, db);
    await pool.end();
    if (!term) throw new Error("the demo term is missing");
    const matched = board.rows.matched.title;
    const plan = r("rows.plan.title", { department: generalStudies });

    const dean = await signedIn(browser, {
      identifier: demoAccounts.dean.employeeNumber,
      password: demo.password,
    });
    await dean.goto("/readiness");
    const remind = (title: string) =>
      dean.getByRole("button", { name: r("remind.label", { title }) });
    await remind(matched).click();
    await expect(dean.getByText(board.remind.none)).toBeVisible();
    await remind(plan).click();
    await expect(
      dean.getByText(r("remind.done", { count: publishers.length })),
    ).toBeVisible();
    // A settled row has no one to remind.
    await expect(remind(board.rows.framework.title)).toHaveCount(0);
    await dean.context().close();

    const admin = await (
      await browser.newContext({ storageState: STORAGE.admin })
    ).newPage();
    // The matched row waits on the admin alone, who reminds no one of it.
    await admin.goto("/readiness");
    await expect(
      admin.getByRole("heading", { level: 1, name: board.title }),
    ).toBeVisible();
    await expect(
      admin.getByRole("button", {
        name: r("remind.label", { title: matched }),
      }),
    ).toHaveCount(0);
    // The vice-dean's reminder, which names its term and opens the page that settles it on it.
    await admin.goto("/notifications");
    const reminder = admin
      .getByRole("link")
      .filter({ hasText: matched })
      .filter({ hasText: demoAccounts.viceDean.name })
      .filter({ hasText: term.name });
    await expect(reminder).toHaveAttribute(
      "href",
      `/switch-term/${term.id}?next=${encodeURIComponent("/rayat")}`,
    );
    // The console lists the admin's open row, linked to the same page.
    await admin.goto("/console");
    const list = new Intl.ListFormat(locale);
    await expect(
      admin.getByRole("link", {
        name: messages.console.attention.readiness
          .replace("{title}", matched)
          .replace(
            "{detail}",
            list.format([
              r("rows.matched.open", { count: 1 }),
              r("rows.matched.disabled", { count: 1 }),
            ]),
          ),
      }),
    ).toHaveAttribute("href", "/rayat");
    await admin.context().close();
  },
);

// A reminder of a term other than the one on view opens its row's page on that term, which the
// header then shows (lead review D): the next term's plan, which Electrical's head has not entered.
test(
  "a reminder of the next term's plan names that term, and opens the plan on it (lead review D)",
  DATABASE,
  async ({ browser, isMobile }) => {
    test.skip(isMobile, "the header names the term on a wide screen");
    const { db, pool } = createDb(databaseUrl());
    const collegeId = (await findCollegeId(db)) ?? "";
    const name = `الفصل القادم ${randomUUID().slice(0, 8)}`;
    const {
      rows: [next],
    } = await pool.query(
      "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2035-01-07', 18) returning id",
      [collegeId, name],
    );
    try {
      const [[{ id: departmentId }], [{ id: viceDean }]] = await Promise.all(
        [
          ["select id from departments where name = $1", electrical],
          [
            "select id from users where email = $1",
            demoAccounts.viceDean.email,
          ],
        ].map(
          async ([query, value]) => (await pool.query(query, [value])).rows,
        ),
      );
      expect(
        await remindOwners(
          { termId: next.id, row: { id: "plan", departmentId } },
          { reach: "college", drafts: true },
          { collegeId, actorId: viceDean },
          () => ({
            title: r("rows.plan.title", { department: electrical }),
            detail: r("rows.plan.open"),
          }),
          new Date(),
          db,
        ),
      ).toMatchObject({ status: "reminded" });

      const head = await signedIn(
        browser,
        {
          identifier: demoAccounts.head.employeeNumber,
          password: demo.password,
        },
        Buffer.from(demo.totpSecret),
      );
      await head.goto("/notifications");
      await head.getByRole("link").filter({ hasText: name }).click();
      await expect(head).toHaveURL(
        new RegExp(`/plan\\?department=${departmentId}$`),
      );
      await expect(head.getByRole("banner").getByText(name)).toBeVisible();
      await head.context().close();
    } finally {
      await pool.query("delete from notifications where once_key like $1", [
        `readiness:${next.id}:%`,
      ]);
      await pool.query("delete from terms where id = $1", [next.id]);
      await pool.end();
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
