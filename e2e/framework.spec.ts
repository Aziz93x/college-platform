import { randomInt } from "node:crypto";
import { createTranslator } from "next-intl";
import { examPeriodTypes } from "../db/seed/base.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { framework: text } = messages;
const locale = `ar-u-nu-${settingsRegistry["locale.digits"].default}`;
const t = createTranslator({ locale, messages, namespace: "framework" });
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// A vice-dean of the test's own, a draft term of its own on view, and what the test made, taken
// away afterwards: the desktop and the phone run side by side.
async function viceDeanWithTerm(account: () => Promise<TestAccount>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  const collegeId = (await findCollegeId(db)) ?? "";
  const person = await account();
  await joinRole(
    { userId: person.userId, collegeId, role: { key: "vice-dean" } },
    db,
  );
  const name = `فصل الإطار ${randomInt(100_000, 999_999)}`;
  const {
    rows: [term],
  } = await pool.query(
    "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2031-01-05', 18) returning id",
    [collegeId, name],
  );
  return {
    person,
    termId: term.id as string,
    // A statement on the term's rows, $1 its id: what another process writes, such as the worker.
    query: (statement: string) => pool.query(statement, [term.id]),
    remove: async () => {
      for (const table of ["tasks", "generation_runs", "frameworks"]) {
        await pool.query(`delete from ${table} where term_id = $1`, [term.id]);
      }
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    },
  };
}

test(
  "the vice-dean starts the term's framework, adds an item, sees what publishing creates, publishes it, and follows the pass that generates its tasks (Steps 15 and 20)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await viceDeanWithTerm(account);
    try {
      const page = await signedIn(browser, {
        identifier: made.person.employeeNumber,
        password: made.person.password,
      });
      await page
        .context()
        .addCookies([
          { name: "term", value: made.termId, url: new URL(page.url()).origin },
        ]);
      await page.goto("/framework");
      await expect(
        page.getByRole("heading", { level: 1, name: text.title }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: text.empty.title }),
      ).toBeVisible();
      await page.getByRole("button", { name: text.empty.action }).click();

      const draft = page.getByRole("region", {
        name: t("draft", { version: 1 }),
      });
      await expect(draft).toContainText(text.noItems);
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch)
        expect(await smallTargets(page.locator("main"))).toEqual([]);
      await page.reload();

      await draft.getByRole("button", { name: text.add }).click();
      const sheet = page.getByRole("dialog", { name: text.addTitle });
      await sheet.getByLabel(text.fields.title).fill("تحليل نتائج الاختبار");
      // A kind far down the long list, chosen by a finger on a phone: the list scrolls within the
      // room it has (lead review C, M1).
      const kind = sheet.getByRole("button", {
        name: new RegExp(`^${text.fields.kind}`),
      });
      await kind.click();
      const analysis = page.getByRole("option", {
        name: text.kinds.grade_analysis,
        exact: true,
      });
      if (hasTouch) await analysis.tap();
      else await analysis.click();
      await expect(kind).toHaveAccessibleName(
        `${text.fields.kind} ${text.kinds.grade_analysis}`,
      );
      // Due the week after the first periodic exams only: a rule anchored to exam periods starts
      // a week before every one of them (the owner's notes, 21 October 2026).
      const choose = async (field: string, option: string) => {
        await sheet
          .getByRole("button", { name: new RegExp(`^${field}`) })
          .click();
        const chosen = page.getByRole("option", { name: option, exact: true });
        if (hasTouch) await chosen.tap();
        else await chosen.click();
      };
      await choose(text.fields.due, text.dueTypes.examPeriods);
      for (const { shortName } of examPeriodTypes.slice(1)) {
        await sheet.getByRole("checkbox", { name: shortName }).click();
      }
      await choose(text.fields.side, text.sides.after);
      await sheet.getByRole("button", { name: text.save }).click();
      await expect(page.getByText(text.saved)).toBeVisible();
      await expect(draft.getByRole("listitem")).toHaveCount(1);
      await expect(draft.getByRole("listitem")).toContainText(
        "تحليل نتائج الاختبار",
      );
      await expect(draft.getByRole("listitem")).toContainText(
        t("dueText.examPeriods", {
          side: "after",
          weeks: 1,
          periods: examPeriodTypes[0].shortName,
        }),
      );
      // Taking an item out asks first, in a sheet that names it, as the plan's does (UX review 2).
      await draft
        .getByRole("button", {
          name: t("remove", { title: "تحليل نتائج الاختبار" }),
        })
        .click();
      const removing = page.getByRole("dialog", {
        name: t("removeTitle", { title: "تحليل نتائج الاختبار" }),
      });
      await removing.getByRole("button", { name: messages.ui.cancel }).click();
      await expect(removing).toBeHidden();
      await expect(draft.getByRole("listitem")).toHaveCount(1);

      // Published from the draft's head, with the tasks it makes, when they are made, and the
      // reviews a week it asks (UX review 2).
      await draft.getByRole("button", { name: text.publish }).click();
      const publish = page.getByRole("dialog", {
        name: t("publishTitle", { version: 1 }),
      });
      await expect(publish.getByText(/^ينشئ/)).toBeVisible();
      await expect(publish).toContainText(text.publishDescription);
      await expect(publish.getByText(/في أكثر الأقسام مراجعةً/)).toBeVisible();
      await publish.getByRole("button", { name: text.publishConfirm }).click();
      await expect(
        page.getByText(t("publishedToast", { version: 1 })),
      ).toBeVisible();
      const published = page.getByRole("region", { name: text.published });
      await expect(published.getByRole("listitem")).toContainText(
        "تحليل نتائج الاختبار",
      );
      // The next version starts from the published one's head, and the versions are listed.
      await expect(
        published.getByRole("button", {
          name: t("newVersion", { version: 2 }),
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: text.versions.title, exact: true }),
      ).toContainText(/النسخة 1 · نُشرت .* · بند واحد/);

      // The term's tasks: no worker runs beside these tests, so the pass publishing queued waits,
      // and the page follows it as the worker writes it, without a reload (Step 20).
      const generation = published.getByRole("status");
      const pass = (set: string) =>
        made.query(`update generation_runs set ${set} where term_id = $1`);
      await expect(generation).toHaveText(text.generation.queued);
      await pass(
        "status = 'running', started_at = now(), total = 10, done = 4",
      );
      await expect(generation).toHaveText(
        t("generation.running", { done: 4, total: 10 }),
        { timeout: 15_000 },
      );
      await expect(
        published.getByRole("progressbar", { name: text.generation.progress }),
      ).toHaveAttribute("aria-valuenow", "40");
      await pass(
        "status = 'done', finished_at = now(), done = 10, created = 10",
      );
      await expect(generation).toContainText(
        t("generation.changes", {
          created: 10,
          updated: 0,
          reassigned: 0,
          cancelled: 0,
        }),
        { timeout: 15_000 },
      );
      await expect(generation).toContainText(/^10 مهام في الفصل/);
      await expect(published.getByRole("progressbar")).toHaveCount(0);
      // Checked once the pass has ended and the page reads it no more: the check rewrites the page's
      // words, and a page still following a pass would write them again.
      expect(await seriousViolations(page)).toEqual([]);
      // A pass that failed, and a version no pass has gone over yet: the nightly one will.
      await pass("status = 'failed', error = 'connection lost'");
      await page.reload();
      await expect(generation).toHaveText(/^تعذّر توليد مهام الفصل/);
      await made.query("delete from generation_runs where term_id = $1");
      await page.reload();
      await expect(generation).toHaveText(text.generation.none);
    } finally {
      await made.remove();
    }
  },
);

test.describe("a trainer", () => {
  test.use({ storageState: STORAGE.trainer });

  test("reads the demo term's published framework, and changes nothing in it", async ({
    page,
  }) => {
    await page.goto("/framework");
    const published = page.getByRole("region", { name: text.published });
    await expect(published.getByRole("listitem").first()).toBeVisible();
    await expect(published).toContainText("تحليل نتائج الاختبار");
    await expect(page.getByRole("button", { name: text.add })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: new RegExp(t("newVersion", { version: "\\d+" })),
      }),
    ).toHaveCount(0);
    // How the generation engine went over the term's tasks is for whoever publishes (Step 20).
    await expect(
      page.getByRole("heading", { name: text.generation.title }),
    ).toHaveCount(0);
  });
});
