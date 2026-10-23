import { randomInt } from "node:crypto";
import type { Page } from "@playwright/test";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId, listDepartments } from "../src/modules/org/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { plan: text, framework, nav, pages } = messages;
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The words of a message with its values in place.
const t = (message: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (words, [name, value]) => words.replaceAll(`{${name}}`, String(value)),
    message,
  );
const mark = (title: string, week: number) =>
  t(text.grid.mark, { title, week });

// A term of the test's own, a draft that its head prepares (Step 19), so the desktop and the phone,
// side by side, each have theirs; and the test's account, head of General Studies.
async function headWithDraftTerm(
  account: (options?: { trainerIn?: string }) => Promise<TestAccount>,
) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  const person = await account();
  const collegeId = (await findCollegeId(db)) ?? "";
  const general = (await listDepartments(collegeId, db)).find(
    ({ name }) => name === demoDepartments[0].name,
  );
  if (!general) throw new Error("e2e: run pnpm seed:demo first");
  await joinRole(
    {
      userId: person.userId,
      collegeId,
      role: { key: "head" },
      departmentId: general.id,
    },
    db,
  );
  const {
    rows: [term],
  } = await pool.query(
    "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2031-01-05', 18) returning id",
    [collegeId, `فصل الخطة ${randomInt(100_000, 999_999)}`],
  );
  return {
    person,
    termId: term.id as string,
    remove: async () => {
      for (const table of ["tasks", "generation_runs", "plans"]) {
        await pool.query(`delete from ${table} where term_id = $1`, [term.id]);
      }
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    },
  };
}

// Signs in and shows the term on the page, as choosing it in the header does.
async function onTerm(
  browser: Parameters<typeof signedIn>[0],
  person: TestAccount,
  termId: string,
) {
  const page = await signedIn(browser, {
    identifier: person.employeeNumber,
    password: person.password,
  });
  await page
    .context()
    .addCookies([
      { name: "term", value: termId, url: new URL(page.url()).origin },
    ]);
  await page.goto("/plan");
  return page;
}

// Chooses an option of one of the sheet's lists.
async function choose(
  page: Page,
  label: string,
  option: string,
  hasTouch: boolean,
) {
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  const choice = page.getByRole("option", { name: option, exact: true });
  if (hasTouch) await choice.tap();
  else await choice.click();
}

test("the head of Electrical sees the plan's draft by weeks, the framework's items locked beside it, and its versions (Step 19)", async ({
  browser,
  hasTouch,
}) => {
  const page = await signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: text.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: t(text.status.draft, { version: 2 }) }),
  ).toBeVisible();
  // What publishing the draft creates, and the reviews it asks of the head each week.
  await expect(page.getByText(/^تُنشئ المسودة/)).toBeVisible();
  await expect(page.getByText(/في الأسبوع:/)).toBeVisible();
  if (hasTouch) {
    // On a phone, a list by week: the lab reports a week earlier than version 1's, in week 11.
    const week = page.getByRole("region", {
      name: t(text.list.week, { week: 11 }),
    });
    await expect(week).toContainText("عينات من تقارير التجارب العملية");
    await expect(
      page.getByRole("region", { name: text.list.recurring }),
    ).toContainText("محاضر اجتماعات القسم");
  } else {
    const grid = page.getByRole("table", { name: text.grid.label });
    await expect(
      grid.getByRole("button", {
        name: mark("عينات من تقارير التجارب العملية", 11),
      }),
    ).toBeVisible();
    // The framework's items follow, locked: no box to choose them, nothing to move.
    const locked = grid.getByRole("row").filter({
      hasText: "نسخة الاختبار ونموذج الإجابة",
    });
    await expect(locked.getByRole("checkbox")).toHaveCount(0);
    await expect(locked.getByLabel(text.grid.locked)).toBeVisible();
  }
  await expect(
    page.getByRole("region", { name: text.versions.title }),
  ).toContainText(/النسخة 1 · نُشرت/);
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) expect(await smallTargets(page.locator("main"))).toEqual([]);
});

test(
  "a head starts their department's plan in the next term while it is a draft, fills it from the sheet, moves its items by week, and publishes a version that changes no more (Step 19)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await headWithDraftTerm(account);
    try {
      const page = await onTerm(browser, made.person, made.termId);
      await expect(
        page.getByRole("heading", { name: text.empty.title }),
      ).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch) {
        expect(await smallTargets(page.locator("main"))).toEqual([]);
      }
      // The check wrote the page's Arabic in Latin letters.
      await page.reload();
      await page.getByRole("button", { name: text.start }).click();
      await expect(
        page.getByRole("heading", {
          name: t(text.status.draft, { version: 1 }),
        }),
      ).toBeVisible();
      await expect(page.getByText(text.noItems)).toBeVisible();

      // Two items in one go: the first for the head themself, by name, then the next.
      await page.getByRole("button", { name: text.add }).click();
      const sheet = page.getByRole("dialog", { name: text.addTitle });
      await sheet.getByLabel(framework.fields.title).fill("محضر لجنة الجودة");
      await choose(
        page,
        framework.fields.appliesTo,
        framework.person,
        hasTouch,
      );
      await sheet
        .getByRole("combobox", { name: framework.fields.person })
        .fill(made.person.employeeNumber);
      await page.getByRole("option", { name: made.person.name }).click();
      await sheet.getByRole("button", { name: framework.saveAndAdd }).click();
      await expect(page.getByText(text.saved)).toBeVisible();
      // Where it lands in the term, as the toast says it.
      await expect(page.getByText("يقع في الأسبوع 1.")).toBeVisible();
      await expect(sheet.getByLabel(framework.fields.title)).toHaveValue("");
      await sheet
        .getByLabel(framework.fields.title)
        .fill("تقرير الأسبوع الثالث");
      await choose(
        page,
        framework.fields.appliesTo,
        framework.eachSection,
        hasTouch,
      );
      for (const _ of [1, 2]) {
        await sheet
          .getByRole("button", { name: framework.more })
          .first()
          .click();
      }
      await sheet.getByRole("button", { name: framework.save }).click();
      await expect(sheet).toBeHidden();

      if (!hasTouch) {
        const grid = page.getByRole("table", { name: text.grid.label });
        // A mark moves a week with the arrow keys: in Arabic the next week is to the left.
        await grid
          .getByRole("button", { name: mark("محضر لجنة الجودة", 1) })
          .press("ArrowLeft");
        await expect(
          grid.getByRole("button", { name: mark("محضر لجنة الجودة", 2) }),
        ).toBeFocused();
        // And by dragging it along its row, to the fifth week.
        const row = grid
          .getByRole("row")
          .filter({ hasText: "تقرير الأسبوع الثالث" });
        await grid
          .getByRole("button", { name: mark("تقرير الأسبوع الثالث", 3) })
          .dragTo(row.getByRole("cell").nth(4));
        await expect(
          grid.getByRole("button", { name: mark("تقرير الأسبوع الثالث", 5) }),
        ).toBeVisible();
        // Both, chosen together, a week later.
        await grid.getByRole("checkbox", { name: text.grid.selectAll }).click();
        await page
          .getByRole("toolbar", { name: text.selection.label })
          .getByRole("button", { name: text.selection.later })
          .click();
        await expect(
          grid.getByRole("button", { name: mark("محضر لجنة الجودة", 3) }),
        ).toBeVisible();
        await expect(
          grid.getByRole("button", { name: mark("تقرير الأسبوع الثالث", 6) }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("region", { name: t(text.list.week, { week: 3 }) }),
        ).toContainText("تقرير الأسبوع الثالث");
      }

      await page.getByRole("button", { name: text.publish }).click();
      const publishing = page.getByRole("dialog", {
        name: t(text.publishTitle, { version: 1 }),
      });
      await expect(publishing.getByText(/^تُنشئ المسودة/)).toBeVisible();
      await publishing
        .getByRole("button", { name: text.publishConfirm })
        .click();
      await expect(
        page.getByText(t(text.publishedToast, { version: 1 })),
      ).toBeVisible();
      // Published, version 1 changes no more: the next is started from it.
      await expect(
        page.getByRole("heading", { name: /^النسخة 1 منشورة منذ/ }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: text.add })).toHaveCount(0);
      await page
        .getByRole("button", { name: t(text.newVersion, { version: 2 }) })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t(text.status.draft, { version: 2 }),
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: text.versions.title }),
      ).toContainText(/النسخة 1 · نُشرت .* · بندان/);
    } finally {
      await made.remove();
    }
  },
);

test(
  "a head builds a 50-item plan in well under 30 minutes, item after item from one sheet (Step 19's usability run)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    test.skip(hasTouch, "Timed once, on the desktop.");
    test.setTimeout(30 * 60_000);
    const made = await headWithDraftTerm(account);
    try {
      const started = Date.now();
      const page = await onTerm(browser, made.person, made.termId);
      await page.getByRole("button", { name: text.start }).click();
      await page.getByRole("button", { name: text.add }).click();
      const sheet = page.getByRole("dialog", { name: text.addTitle });
      const title = sheet.getByLabel(framework.fields.title);
      for (let item = 1; item <= 50; item++) {
        await title.fill(`بند الخطة ${item}`);
        // Every fifth item a week later than the one before, as a head spreads the term's work.
        if (item % 5 === 0) {
          await sheet
            .getByRole("button", { name: framework.more })
            .first()
            .click();
        }
        await sheet.getByRole("button", { name: framework.saveAndAdd }).click();
        await expect(title).toHaveValue("");
      }
      await sheet.getByRole("button", { name: messages.ui.cancel }).click();
      const grid = page.getByRole("table", { name: text.grid.label });
      await expect(grid.getByRole("checkbox")).toHaveCount(51);
      await page.getByRole("button", { name: text.publish }).click();
      await page
        .getByRole("dialog", { name: t(text.publishTitle, { version: 1 }) })
        .getByRole("button", { name: text.publishConfirm })
        .click();
      await expect(
        page.getByRole("heading", { name: /^النسخة 1 منشورة منذ/ }),
      ).toBeVisible();
      expect(Date.now() - started).toBeLessThan(30 * 60_000);
    } finally {
      await made.remove();
    }
  },
);

test(
  "a head reads a closed term's plan, with nothing to add, move or take out (Step 19)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await headWithDraftTerm(account);
    try {
      const url = process.env.DATABASE_URL ?? "";
      const { pool } = createDb(url);
      // General Studies' plan of a term that has since closed, its draft never published.
      await pool.query(
        `with plan as (
           insert into plans (college_id, term_id, department_id, version)
           select t.college_id, t.id, d.id, 1 from terms t, departments d
           where t.id = $1 and d.name = $2 returning id, college_id
         )
         insert into plan_items (college_id, plan_id, position, title, axis_id, kind, applies_to, due, evidence)
         select plan.college_id, plan.id, 0, 'عينات الواجبات', a.id, 'homework', '{"type": "eachSection"}',
           '{"type": "week", "week": 3}',
           '{"required": true, "types": ["pdf"], "maxFiles": 1, "requiresApproval": false}'
         from plan, axes a where a.college_id = plan.college_id limit 1`,
        [made.termId, demoDepartments[0].name],
      );
      await pool.query("update terms set status = 'closed' where id = $1", [
        made.termId,
      ]);
      await pool.end();
      const page = await onTerm(browser, made.person, made.termId);
      await expect(page.getByText(text.closed)).toBeVisible();
      const main = page.locator("main");
      await expect(main).toContainText("عينات الواجبات");
      await expect(main.getByRole("checkbox")).toHaveCount(0);
      await expect(
        main.getByRole("button", { name: /عينات الواجبات/ }),
      ).toHaveCount(0);
      await expect(main.getByRole("button", { name: text.add })).toHaveCount(0);
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch) {
        // The check wrote the page's Arabic in Latin letters.
        await page.reload();
        expect(await smallTargets(main)).toEqual([]);
      }
    } finally {
      await made.remove();
    }
  },
);

test.describe("without the key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the plan page, and the shell offers none", async ({
    page,
  }) => {
    await page.goto("/plan");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: nav.plan })).toHaveCount(0);
  });
});
