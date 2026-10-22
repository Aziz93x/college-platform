import { randomInt } from "node:crypto";
import { createTranslator } from "next-intl";
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
    remove: async () => {
      await pool.query("delete from frameworks where term_id = $1", [term.id]);
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    },
  };
}

test(
  "the vice-dean starts the term's framework, adds an item, sees what publishing creates, and publishes it (Step 15)",
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
      await sheet.getByRole("button", { name: text.save }).click();
      await expect(page.getByText(text.saved)).toBeVisible();
      await expect(draft.getByRole("listitem")).toHaveCount(1);
      await expect(draft.getByRole("listitem")).toContainText(
        "تحليل نتائج الاختبار",
      );

      await draft.getByRole("button", { name: text.publish }).click();
      const publish = page.getByRole("dialog", {
        name: t("publishTitle", { version: 1 }),
      });
      await expect(publish.getByText(/^ينشئ/)).toBeVisible();
      await publish.getByRole("button", { name: text.publishConfirm }).click();
      await expect(
        page.getByText(t("publishedToast", { version: 1 })),
      ).toBeVisible();
      const published = page.getByRole("region", { name: text.published });
      await expect(published.getByRole("listitem")).toContainText(
        "تحليل نتائج الاختبار",
      );
      await expect(
        page.getByRole("button", { name: text.newVersion }),
      ).toBeVisible();
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
      page.getByRole("button", { name: text.newVersion }),
    ).toHaveCount(0);
  });
});
