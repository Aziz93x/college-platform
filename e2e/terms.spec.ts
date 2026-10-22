import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { addDays } from "../src/platform/i18n/time-zone.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
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
      await pool.query("delete from terms where name = any($1)", [names]);
      await pool.end();
    },
  };
}

test(
  "the vice-dean makes an 18-week term with a week of holiday and an exam week on the screen, its weeks counted past the holiday, and opens the next term from it (Step 13)",
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
        page.getByRole("region", { name: text.breaks.title }),
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

      // A week of holiday from its fourth Sunday, and the midterm exams in week 8.
      const calendar = page.getByRole("region", { name: text.calendar.title });
      const add = async (
        kind: "holiday" | "exam",
        title: string,
        days: string[],
      ) => {
        await calendar.getByRole("button", { name: text.calendar.add }).click();
        const sheet = page.getByRole("dialog", {
          name: text.calendar.addTitle,
        });
        if (kind !== "holiday") {
          await sheet
            .getByRole("button", { name: new RegExp(`^${text.calendar.kind}`) })
            .click();
          await page.getByRole("option", { name: text.kinds[kind] }).click();
        }
        await sheet.getByLabel(text.calendar.eventTitle).fill(title);
        await pick(page, sheet, text.calendar.days, days);
        await sheet.getByRole("button", { name: text.calendar.save }).click();
        await expect(
          page.getByText(t("calendar.added", { title })),
        ).toBeVisible();
        await expect(sheet).toBeHidden();
      };
      await add("holiday", "إجازة منتصف الفصل", [
        addDays(first, 21),
        addDays(first, 27),
      ]);
      const weeks = page.getByRole("region", { name: text.weeks.title });
      const rows = weeks.getByRole("listitem");
      // 18 numbered weeks and the holiday's.
      await expect(rows).toHaveCount(19);
      await expect(rows.nth(3)).toContainText(text.weeks.holiday);
      await expect(rows.nth(4)).toContainText(t("weeks.number", { number: 4 }));
      // Week 8 now starts five weeks after the holiday's Sunday.
      await add("exam", "اختبارات منتصف الفصل", [
        addDays(first, 56),
        addDays(first, 60),
      ]);
      await expect(
        calendar
          .getByRole("listitem")
          .filter({ hasText: "اختبارات منتصف الفصل" }),
      ).toContainText(t("calendar.week", { number: 8 }));
      if (hasTouch) {
        expect(await smallTargets(calendar)).toEqual([]);
      }

      // The next term: the exam week at the same place in its weeks, the holiday left behind.
      await page.getByRole("button", { name: text.lifecycle.next }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByLabel(text.form.name).fill(next);
      await sheet
        .getByRole("button", { name: text.lifecycle.nextConfirm })
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: next }),
      ).toBeVisible();
      const copied = page
        .getByRole("region", { name: text.calendar.title })
        .getByRole("listitem");
      await expect(
        copied.filter({ hasText: "اختبارات منتصف الفصل" }),
      ).toContainText(t("calendar.week", { number: 8 }));
      await expect(copied.filter({ hasText: "إجازة منتصف الفصل" })).toHaveCount(
        0,
      );
    } finally {
      await made.remove([name, next]);
    }
  },
);

test(
  "the Eid breaks of the years ahead are estimates the vice-dean adjusts to the days announced",
  DATABASE,
  async ({ browser, account }) => {
    const made = await viceDean(account);
    // The last break of the ten years: no term of the demo reaches it.
    const {
      rows: [last],
    } = await made.pool.query(
      `select id, name, hijri_year, to_char(starts_on, 'YYYY-MM-DD') as starts_on,
         to_char(ends_on, 'YYYY-MM-DD') as ends_on
       from holidays order by starts_on desc limit 1`,
    );
    try {
      const page = await signedIn(browser, {
        identifier: made.person.employeeNumber,
        password: made.person.password,
      });
      await page.goto("/terms");
      await expect(
        page.getByRole("heading", { level: 1, name: text.title }),
      ).toBeVisible();
      const breaks = page.getByRole("region", { name: text.breaks.title });
      const year = String(last.hijri_year);
      const row = breaks
        .getByRole("listitem")
        .filter({ hasText: t("breaks.name", { name: last.name, year }) });
      await expect(row).toContainText(text.breaks.estimated);
      await row
        .getByRole("button", {
          name: t("breaks.edit", { name: last.name, year }),
        })
        .click();
      const sheet = page.getByRole("dialog");
      // A day longer: the announcement kept the college off one more Saturday.
      await pick(page, sheet, text.breaks.days, [
        last.starts_on,
        addDays(last.ends_on, 7),
      ]);
      await sheet.getByRole("button", { name: text.breaks.save }).click();
      await expect(
        page.getByText(t("breaks.saved", { name: last.name, year })),
      ).toBeVisible();
      await expect(row).toContainText(text.breaks.adjusted);
    } finally {
      await made.pool.query(
        "update holidays set starts_on = $2, ends_on = $3, adjusted = false where id = $1",
        [last.id, last.starts_on, last.ends_on],
      );
      await made.remove([]);
    }
  },
);

test("a trainer sees the term and its week in the header and on Today, its calendar from the switcher, and no terms page", async ({
  browser,
  account,
}) => {
  const person = await account();
  const page = await signedIn(browser, {
    identifier: person.employeeNumber,
    password: person.password,
  });
  // The demo term puts today in week 9 of 18 (seed:demo --week 9), or in a week of an Eid break
  // just before it.
  await expect(
    page.getByText(
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
  ).toContainText(t("weeks.number", { number: 9 }));
  await expect(
    page.getByRole("button", { name: text.calendar.add }),
  ).toHaveCount(0);
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: messages.pages.forbidden.title }),
  ).toBeVisible();
});
