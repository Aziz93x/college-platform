import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { examPeriodTypes, holidayRules } from "../db/seed/base.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { umAlQuraYear } from "../src/modules/terms/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { addDays, wallClock } from "../src/platform/i18n/time-zone.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { valueOnTop } from "./support/stepper.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { terms: text, nav, dateRange } = messages;
// The college's digits, the default, as the pages write numbers and dates.
const locale = `ar-u-nu-${settingsRegistry["locale.digits"].default}`;
const t = createTranslator({ locale, messages, namespace: "terms" });
const today = createTranslator({ locale, messages, namespace: "today" });
const shell = createTranslator({ locale, messages, namespace: "shell" });
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };
// Today on the college's clock, as the pages take it: the runner's UTC day is already behind it
// from 21:00 in Riyadh (Audit 5).
const collegeDay = () =>
  wallClock(new Date(), settingsRegistry["locale.timeZone"].default).slice(
    0,
    10,
  );
// This Umm al-Qura year, and as the page writes it.
const thisYear = umAlQuraYear(collegeDay());
const yearWords = (year: number) =>
  new Intl.NumberFormat(locale, { useGrouping: false }).format(year);

// The name a day of the date picker goes by.
const dayName = (day: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

// Opens the picker named so in a scope, and picks each day in turn, moving on a month at a time
// until the day is on show.
async function pick(page: Page, scope: Locator, label: string, days: string[]) {
  await scope.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  for (const day of days) {
    const button = page.getByRole("button", {
      name: dayName(day),
      exact: true,
    });
    for (let month = 0; month < 12 && !(await button.isVisible()); month++) {
      await page.getByRole("button", { name: dateRange.next.month }).click();
    }
    await button.click();
  }
}

// The first Sunday from next month on the runner's clock whose twenty weeks no Eid break of the
// college's touches (ADR-0018), so the test's own holiday is the only one its term counts.
async function clearSunday(pool: {
  query: (
    text: string,
  ) => Promise<{ rows: { starts_on: string; ends_on: string }[] }>;
}) {
  const { rows: breaks } = await pool.query(
    "select to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on from holidays",
  );
  const now = new Date();
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  let sunday = addDays(
    first.toISOString().slice(0, 10),
    (7 - first.getUTCDay()) % 7,
  );
  while (
    breaks.some(
      (each) =>
        each.starts_on <= addDays(sunday, 20 * 7) && sunday <= each.ends_on,
    )
  ) {
    sunday = addDays(sunday, 7);
  }
  return sunday;
}

// A vice-dean of the test's own, and what the test made, taken away afterwards.
async function viceDean(account: () => Promise<TestAccount>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  const collegeId = (await findCollegeId(db)) ?? "";
  const person = await account();
  await joinRole(
    { userId: person.userId, collegeId, role: { key: "vice-dean" } },
    db,
  );
  return {
    person,
    pool,
    remove: async (names: string[]) => {
      // The pass the exam periods queued names its term.
      await pool.query(
        "delete from generation_runs where term_id in (select id from terms where name = any($1))",
        [names],
      );
      await pool.query("delete from terms where name = any($1)", [names]);
      await pool.end();
    },
  };
}

test(
  "the vice-dean makes an 18-week term with a week of holiday and its exam periods by week number on the screen, its weeks counted past the holiday, and opens the next term from it (Step 13, the owner's notes of 21 October 2026)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await viceDean(account);
    const number = randomInt(100_000, 999_999);
    const name = `فصل الاختبار ${number}`;
    const next = `الفصل التالي ${number}`;
    try {
      const page = await signedIn(browser, {
        identifier: made.person.employeeNumber,
        password: made.person.password,
      });
      await expect(
        page.getByRole("link", { name: nav.terms }).first(),
      ).toBeAttached();
      await page.goto("/terms");
      await expect(
        page.getByRole("heading", { level: 1, name: text.title }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", {
          name: t("breaks.title", { year: yearWords(thisYear) }),
        }),
      ).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.reload();

      // A new term: its name, its first day, and the usual 18 weeks.
      await page.getByRole("link", { name: text.add }).first().click();
      const form = page.locator("form");
      await form.getByLabel(text.form.name).fill(name);
      const first = await clearSunday(made.pool);
      await pick(page, form, text.form.startsOn, [first]);
      await page.getByRole("button", { name: text.form.create }).click();
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(page.getByText(t("status.draft")).first()).toBeVisible();

      // A week of holiday from its fourth Sunday.
      const calendar = page.getByRole("region", { name: text.calendar.title });
      await calendar.getByRole("button", { name: text.calendar.add }).click();
      const holiday = page.getByRole("dialog", {
        name: text.calendar.addTitle,
      });
      await holiday
        .getByLabel(text.calendar.eventTitle)
        .fill("إجازة منتصف الفصل");
      await pick(page, holiday, text.calendar.days, [
        addDays(first, 21),
        addDays(first, 27),
      ]);
      await holiday.getByRole("button", { name: text.calendar.save }).click();
      await expect(
        page.getByText(t("calendar.added", { title: "إجازة منتصف الفصل" })),
      ).toBeVisible();
      await expect(holiday).toBeHidden();
      const weeks = page.getByRole("region", { name: text.weeks.title });
      const rows = weeks.getByRole("listitem");
      // 18 numbered weeks and the holiday's.
      await expect(rows).toHaveCount(19);
      await expect(rows.nth(3)).toContainText(text.weeks.holiday);
      await expect(rows.nth(4)).toContainText(t("weeks.number", { number: 4 }));
      // The holiday week's tinted row keeps its text readable (Audit 5).
      expect(await seriousViolations(page)).toEqual([]);
      await page.reload();
      // The first periodic exams by week number: a period starts in the term's first week, and the
      // vice-dean steps it to weeks 5 and 6, counted past the holiday.
      const periods = page.getByRole("region", { name: text.periods.title });
      const [periodic, second] = examPeriodTypes;
      const step = async (
        type: string,
        which: "from" | "to",
        button: string,
        times: number,
      ) => {
        const stepper = periods.getByRole("group", {
          name: `${type} ${text.periods[which]}`,
        });
        for (let time = 0; time < times; time++) {
          await stepper.getByRole("button", { name: button }).click();
        }
      };
      await periods
        .getByRole("button", {
          name: t("periods.addOf", { name: periodic.name }),
        })
        .click();
      await step(periodic.name, "to", text.periods.later, 5);
      await step(periodic.name, "from", text.periods.later, 4);
      // The second periodic starts the week after it; a week earlier, they would share week 6.
      await periods
        .getByRole("button", {
          name: t("periods.addOf", { name: second.name }),
        })
        .click();
      await step(second.name, "from", text.periods.earlier, 1);
      await expect(
        periods.getByText(
          t("periods.overlap", { first: periodic.name, second: second.name }),
        ),
      ).toBeVisible();
      await periods.getByRole("button", { name: text.periods.save }).click();
      await expect(periods.getByText(text.periods.fixFirst)).toBeVisible();
      await step(second.name, "from", text.periods.later, 1);
      // Saved as every edit form saves: Save and Discard once something changed, then nothing
      // (UX review 2).
      const discard = periods.getByRole("button", {
        name: messages.ui.discard,
      });
      await expect(discard).toBeVisible();
      await periods.getByRole("button", { name: text.periods.save }).click();
      await expect(page.getByText(text.periods.saved)).toBeVisible();
      await expect(discard).toHaveCount(0);
      await expect(
        periods.getByRole("listitem").filter({ hasText: periodic.name }),
      ).toContainText(t("periods.weeks", { from: 5, to: 6 }));
      // The weeks they take name them.
      await expect(rows.nth(5)).toContainText(periodic.name);
      await expect(rows.nth(7)).toContainText(second.name);
      if (hasTouch) {
        expect(await smallTargets(periods)).toEqual([]);
      }
      expect(await seriousViolations(page)).toEqual([]);
      await page.reload();

      // The next term: the periods in the same weeks, the holiday left behind.
      await page.getByRole("button", { name: text.lifecycle.next }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByLabel(text.form.name).fill(next);
      await sheet
        .getByRole("button", { name: text.lifecycle.nextConfirm })
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: next }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: text.periods.title })
          .getByRole("listitem")
          .filter({ hasText: periodic.name }),
      ).toContainText(t("periods.weeks", { from: 5, to: 6 }));
      await expect(
        page
          .getByRole("region", { name: text.calendar.title })
          .getByRole("listitem")
          .filter({ hasText: "إجازة منتصف الفصل" }),
      ).toHaveCount(0);

      // Both terms are still drafts, which only those who manage terms see: the demo trainer finds
      // the new one neither at its address nor in the header's switcher (Audit 5).
      const trainer = await (
        await browser.newContext({ storageState: STORAGE.trainer })
      ).newPage();
      await trainer.goto(page.url());
      await expect(
        trainer.getByRole("heading", { name: messages.pages.notFound.title }),
      ).toBeVisible();
      await trainer
        .locator("header")
        .getByRole("button", {
          name: new RegExp(
            `${shell("term.open", { name: ".+" })}|${shell("term.openWithWeek", { name: ".+", week: ".+" })}`,
          ),
        })
        .click();
      const terms = trainer.getByRole("list", { name: shell("term.list") });
      await expect(terms.getByRole("button").first()).toBeVisible();
      await expect(
        terms.getByRole("button", { name: new RegExp(`${name}|${next}`) }),
      ).toHaveCount(0);
      await trainer.context().close();
    } finally {
      await made.remove([name, next]);
    }
  },
);

test(
  "the vice-dean sees this year's holidays only, and approves an estimate as it is or adjusts its days (ADR-0018)",
  DATABASE,
  async ({ browser, account }) => {
    const made = await viceDean(account);
    // A holiday of the test's own on a Friday and Saturday's weekend, so no term's weeks move
    // whatever today is. It is at least two days ahead on the college's clock, so it has not
    // begun when the test approves it, whatever the hour.
    const number = randomInt(100_000, 999_999);
    const name = `إجازة الاختبار ${number}`;
    const today = collegeDay();
    const ahead = (5 - new Date(`${today}T00:00:00Z`).getUTCDay() + 7) % 7;
    const friday = addDays(today, ahead < 2 ? ahead + 7 : ahead);
    await made.pool.query(
      `insert into holidays (college_id, key, name, hijri_year, starts_on, ends_on)
       select college_id, $1, $2, $3, $4, $4 from holidays limit 1`,
      [`e2e-${number}`, name, thisYear, friday],
    );
    try {
      const page = await signedIn(browser, {
        identifier: made.person.employeeNumber,
        password: made.person.password,
      });
      await page.goto("/terms");
      const breaks = page.getByRole("region", {
        name: t("breaks.title", { year: yearWords(thisYear) }),
      });
      const year = yearWords(thisYear);
      const row = breaks
        .getByRole("listitem")
        .filter({ hasText: t("breaks.name", { name, year }) });
      await expect(row).toContainText(text.breaks.estimated);
      // Next year's Eid al-Fitr break waits for its year.
      await expect(
        breaks.getByText(
          t("breaks.name", {
            name: holidayRules[0].name,
            year: yearWords(thisYear + 1),
          }),
        ),
      ).toHaveCount(0);

      // Approved as estimated.
      await row
        .getByRole("button", { name: t("breaks.approveLabel", { name, year }) })
        .click();
      await expect(
        page.getByText(t("breaks.approved", { name, year })),
      ).toBeVisible();
      await expect(row).toContainText(text.breaks.adjusted);

      // Then a day longer, as the announcement said.
      await row
        .getByRole("button", { name: t("breaks.edit", { name, year }) })
        .click();
      const sheet = page.getByRole("dialog");
      await pick(page, sheet, text.breaks.days, [friday, addDays(friday, 1)]);
      await sheet.getByRole("button", { name: text.breaks.save }).click();
      await expect(
        page.getByText(t("breaks.saved", { name, year })),
      ).toBeVisible();
    } finally {
      await made.pool.query("delete from holidays where key = $1", [
        `e2e-${number}`,
      ]);
      await made.remove([]);
    }
  },
);

// How far the page scrolls sideways: nothing on a phone.
const sideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("the admin", () => {
  test.use({ storageState: STORAGE.admin });

  test("reads an exam period's weeks whole where its stepper is at a bound, and on a phone at 200% text neither term page scrolls sideways (UX review 2)", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/today");
    await page
      .locator("header")
      .getByRole("button", {
        name: new RegExp(
          `${shell("term.open", { name: ".+" })}|${shell("term.openWithWeek", { name: ".+", week: ".+" })}`,
        ),
      })
      .click();
    await page.getByRole("link", { name: shell("term.calendar") }).click();
    const periods = page.getByRole("region", { name: text.periods.title });
    // The demo's theoretical final ends in the term's last week, and its practical final is one
    // week long, so its first week can go no later.
    const [, , practical, theoretical] = examPeriodTypes;
    for (const [type, which] of [
      [theoretical.name, "to"],
      [practical.name, "from"],
    ] as const) {
      const stepper = periods.getByRole("group", {
        name: `${type} ${text.periods[which]}`,
      });
      await expect(stepper.getByRole("button")).toHaveCount(1);
      await expect.poll(() => valueOnTop(stepper)).toBe(true);
    }
    if (!isMobile) return;

    // The phone's text at 200%, which enlarges the steppers with it.
    for (const path of [new URL(page.url()).pathname, "/terms/new"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.addStyleTag({ content: "html { font-size: 200% }" });
      await expect.poll(() => sideways(page)).toBe(0);
    }
  });
});

test.describe("a trainer", () => {
  test.use({ storageState: STORAGE.trainer });

  test("sees the term and its week in the header and on Today, its calendar from the switcher, and no terms page", async ({
    page,
  }) => {
    await page.goto("/today");
    // The demo term puts today in week 9 of 18 (seed:demo --week 9), or in a week of an Eid break
    // just before it, which Today and the header both call a holiday week.
    await expect(
      page
        .locator("main")
        .getByText(
          new RegExp(
            `^(${today("term.week", { number: 9, weeks: 18 })}|${today("term.holiday")})$`,
          ),
        ),
    ).toBeVisible();
    const switcher = page.locator("header").getByRole("button", {
      name: new RegExp(
        `${shell("term.week", { number: 9 })}|${shell("term.holiday")}`,
      ),
    });
    await switcher.click();
    await page.getByRole("link", { name: shell("term.calendar") }).click();
    await expect(
      page
        .getByRole("region", { name: text.weeks.title })
        .locator('[aria-current="date"]'),
    ).toContainText(
      new RegExp(`${t("weeks.number", { number: 9 })}|${text.weeks.holiday}`),
    );
    await expect(
      page.getByRole("button", { name: text.calendar.add }),
    ).toHaveCount(0);
    // A day of the calendar reads with its week first, as the weeks and the exam periods do
    // (UX review 2).
    await expect(
      page.getByRole("region", { name: text.calendar.title }),
    ).toContainText(
      new RegExp(
        `${t("calendar.week", { number: 0 }).replace("0", "\\d+")} · \\d`,
      ),
    );
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: messages.pages.forbidden.title }),
    ).toBeVisible();
  });
});
