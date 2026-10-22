import { randomInt } from "node:crypto";
import type { Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { seriousViolations } from "./support/axe.ts";
import { open, signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { announcements: text, nav } = messages;
// The catalog's plurals, in the digits the demo college keeps (the default).
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "announcements",
});
const notices = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "notifications",
});
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// A department of the test's own, with a head and a trainer of its own: an announcement there
// reaches no one another test signs in as, whose pages it would open over (ADR-0017).
async function department(
  account: (options?: { trainerIn?: string }) => Promise<TestAccount>,
) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  const collegeId = (await findCollegeId(db)) ?? "";
  const number = randomInt(100_000, 999_999);
  const name = `قسم الإعلانات ${number}`;
  const {
    rows: [{ id }],
  } = await pool.query(
    "insert into departments (college_id, name, short_name) values ($1, $2, $3) returning id",
    [collegeId, name, `ANN${number}`],
  );
  const head = await account();
  await joinRole(
    { userId: head.userId, collegeId, role: { key: "head" }, departmentId: id },
    db,
  );
  const trainer = await account({ trainerIn: name });
  return {
    name,
    head,
    trainer,
    // What the test made, taken away once its people are gone with the fixture.
    remove: async () => {
      await pool.query("delete from announcements where department_id = $1", [
        id,
      ]);
      await pool.query("delete from memberships where department_id = $1", [
        id,
      ]);
      await pool.query("delete from departments where id = $1", [id]);
      await pool.end();
    },
  };
}

const signIn = (browser: Parameters<typeof signedIn>[0], person: TestAccount) =>
  signedIn(browser, {
    identifier: person.employeeNumber,
    password: person.password,
  });

// The head announces on their page: the department is the one place they announce to.
async function announce(page: Page, title: string, body: string) {
  await page.getByLabel(text.form.heading).fill(title);
  await page.getByLabel(text.form.body, { exact: true }).fill(body);
  await page.getByRole("button", { name: text.form.submit }).click();
  await expect(
    page.getByText(t("form.published", { count: 1 })).last(),
  ).toBeVisible();
}

test(
  "a head's announcements open over their trainer's next page, newest first with the page blurred, closing reads each for good and the head sees it read, and a withdrawn one leaves the center (ADR-0017)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await department(account);
    try {
      const head = await signIn(browser, made.head);
      await expect(
        head.getByRole("link", { name: nav.announcements }).first(),
      ).toBeAttached();
      await open(head, "/announcements");
      await expect(head.getByText(made.name)).toBeVisible();
      await announce(head, "اجتماع القسم", "نجتمع يوم الأحد.\n\nفي القاعة ٣.");
      await announce(head, "تسليم الخطط", "قبل نهاية الأسبوع.");
      const live = head
        .getByRole("region", { name: text.list.title })
        .getByRole("listitem");
      await expect(live).toHaveCount(2);
      await expect(live.first()).toContainText("تسليم الخطط");
      // Its author sees how many of those it reached have read it: none yet (ADR-0017, decision 7).
      await expect(live.first()).toContainText(
        t("list.reads", { read: 0, reached: 1 }),
      );

      // At the trainer's sign-in, the newest opens in the middle, over the page blurred.
      const trainer = await signIn(browser, made.trainer);
      const newest = trainer.getByRole("dialog", { name: "تسليم الخطط" });
      await expect(newest).toBeVisible();
      await expect(newest).toContainText(made.head.name);
      await expect(newest).toContainText(made.name);
      expect(
        await trainer
          .locator('[data-slot="dialog-overlay"]')
          .evaluate((overlay) => getComputedStyle(overlay).backdropFilter),
      ).toContain("blur");
      if (hasTouch) {
        expect(await smallTargets(newest)).toEqual([]);
      }
      expect(await seriousViolations(trainer)).toEqual([]);
      // Axe reads the page with its Arabic made Latin, so it is opened again before it is used.
      await trainer.reload();
      await expect(newest).toBeVisible();
      await newest.getByRole("button", { name: text.dialog.close }).click();
      const older = trainer.getByRole("dialog", { name: "اجتماع القسم" });
      await expect(older).toBeVisible();
      await expect(older).toContainText("في القاعة ٣.");
      await trainer.keyboard.press("Escape");
      await expect(older).toBeHidden();

      // Closed is read: the bell counts them no more once the readings are in, they do not come
      // back, and the center keeps them.
      await expect(
        trainer.locator("header").getByRole("button", {
          name: new RegExp(`^${messages.notifications.title}`),
        }),
      ).toHaveAccessibleName(notices("bell", { count: 0 }));
      await trainer.reload();
      await expect(trainer.getByRole("dialog")).toHaveCount(0);
      // Closed is read, and the author's page counts it.
      await head.reload();
      for (const each of [live.first(), live.last()]) {
        await expect(each).toContainText(
          t("list.reads", { read: 1, reached: 1 }),
        );
      }
      await trainer.goto("/notifications");
      const rows = trainer
        .locator("main")
        .getByRole("link")
        .filter({ hasText: "اجتماع القسم" });
      await expect(rows).toHaveCount(1);
      await expect(rows).not.toContainText(notices("unread"));

      // Withdrawn, it leaves the center.
      await head
        .getByRole("button", {
          name: t("list.withdrawLabel", { title: "اجتماع القسم" }),
        })
        .click();
      await head
        .getByRole("dialog")
        .getByRole("button", { name: text.withdraw.confirm })
        .click();
      await expect(head.getByText(text.withdraw.done)).toBeVisible();
      await expect(live).toHaveCount(1);
      await trainer.reload();
      await expect(rows).toHaveCount(0);
      await expect(
        trainer
          .locator("main")
          .getByRole("link")
          .filter({ hasText: "تسليم الخطط" }),
      ).toHaveCount(1);

      // A trainer announces nothing: the page is not theirs.
      await trainer.goto("/announcements");
      await expect(
        trainer.getByRole("heading", { name: messages.pages.forbidden.title }),
      ).toBeVisible();
    } finally {
      await made.remove();
    }
  },
);

test(
  "the preferences say announcements always come, with no switch to turn them off",
  DATABASE,
  async ({ browser, account }) => {
    const person = await account();
    const page = await signIn(browser, person);
    await page.goto("/notifications/preferences");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: notices("kinds.announcement.label") });
    await expect(row).toContainText(notices("preferences.always"));
    await expect(row.getByRole("switch")).toHaveCount(0);
  },
);
