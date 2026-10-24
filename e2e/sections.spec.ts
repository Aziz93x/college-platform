import { createTranslator } from "next-intl";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { demoVisitor } from "../db/seed/demo/rayat.ts";
import messages from "../messages/ar.json" with { type: "json" };
import {
  listSections,
  transferCandidates,
} from "../src/modules/academics/index.ts";
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId, listDepartments } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { activeTerm } from "../src/modules/terms/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { sections: text, pages, nav } = messages;
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "sections",
});
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

test("the head of Electrical sees the department's sections with their trainers, schedule and numbers, the transfer they made holding until the next SS01, and the visitor Rayat names as not on the platform (Step 17)", async ({
  browser,
  hasTouch,
}) => {
  const page = await signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );
  await page.goto("/sections");
  await expect(
    page.getByRole("heading", { level: 1, name: text.title }),
  ).toBeVisible();
  const main = page.locator("main");
  await expect(main.getByRole("article").first()).toContainText(text.schedule);
  await expect(main).toContainText(text.transfers.status.holds);
  await expect(main).toContainText(
    t("notOnPlatform", { number: demoVisitor.employeeNumber }),
  );
  // The earlier transfer, which the next SS01 is in conflict with, comes first (ADR-0020).
  await expect(main).toContainText(t("needsHead", { count: 1 }));
  await expect(main.getByRole("article").first()).toContainText(
    text.transfers.status.conflict,
  );
  // A transfer's day is written as every page writes one, not in figures (UX review 2).
  await expect(main).not.toContainText(/\d+\/\d+\/\d+/);
  // Keeping it and cancelling it are ghost buttons alike, neither looking disabled (UX review 2).
  const colour = (name: string) =>
    main
      .getByRole("article")
      .first()
      .getByRole("button", { name })
      .evaluate((button) => getComputedStyle(button).color);
  expect(await colour(text.transfers.keep)).toBe(
    await colour(text.transfers.cancel.button),
  );
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) expect(await smallTargets(main)).toEqual([]);
});

test("marks a section's trainer whose account an admin disabled, whose tasks no one can sign in to do (lead review D, proposal 1)", async ({
  browser,
}) => {
  const page = await signedIn(browser, {
    identifier: demoAccounts.viceDean.employeeNumber,
    password: demo.password,
  });
  await page.goto("/sections");
  const main = page.locator("main");
  await main
    .getByRole("button", { name: new RegExp(`^${text.filters.department}`) })
    .click();
  await page
    .getByRole("option", { name: demoDepartments[0].name, exact: true })
    .click();
  await expect(main).toContainText(
    t("disabledAccount", { name: demoAccounts.disabledTrainer.name }),
  );
  await page.context().close();
});

test("the vice-dean, who imports Rayat, reads each department's sections without changing them, one department at a time, and finds one by its reference (ADR-0021)", async ({
  browser,
  hasTouch,
}) => {
  const page = await signedIn(browser, {
    identifier: demoAccounts.viceDean.employeeNumber,
    password: demo.password,
  });
  await page.goto("/sections");
  const main = page.locator("main");
  await expect(main.getByRole("article").first()).toBeVisible();
  await expect(
    main.getByRole("button", { name: text.transfer.button }),
  ).toHaveCount(0);
  // The third department has a section taught by two trainers and one with none yet.
  await main
    .getByRole("button", { name: new RegExp(`^${text.filters.department}`) })
    .click();
  await page
    .getByRole("option", { name: demoDepartments[2].name, exact: true })
    .click();
  await expect(page).toHaveURL(/department=/);
  await expect(main).toContainText(text.noTrainer);
  const heading = await main
    .getByRole("article")
    .last()
    .getAttribute("aria-labelledby");
  const ref = heading?.replace("section-", "") ?? "";
  await main.getByRole("searchbox", { name: text.filters.search }).fill(ref);
  await expect(page).toHaveURL(new RegExp(`q=${ref}`));
  await expect(main.getByRole("article")).toHaveCount(1);
  await expect(main.getByRole("article")).toContainText(t("section", { ref }));
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) {
    // The check wrote the page's Arabic in Latin letters.
    await page.reload();
    expect(await smallTargets(main)).toEqual([]);
  }
});

test(
  "a head transfers a section of their department to another of its trainers from a week on, then cancels it (Step 17)",
  DATABASE,
  async ({ browser, account, hasTouch }, testInfo) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { db, pool } = createDb(url);
    const person = await account();
    try {
      const collegeId = (await findCollegeId(db)) ?? "";
      const term = await activeTerm(collegeId, db);
      const electrical = (await listDepartments(collegeId, db)).find(
        ({ name }) => name === demoDepartments[1].name,
      );
      if (!term || !electrical)
        throw new Error("e2e: run pnpm seed:demo first");
      await joinRole(
        {
          userId: person.userId,
          collegeId,
          role: { key: "head" },
          departmentId: electrical.id,
        },
        db,
      );
      // A section no transfer has touched, another for each device, as they run side by side.
      const untouched = (
        await listSections(collegeId, term.id, [electrical.id], 1, db)
      ).sections.filter(
        (section) =>
          section.transfers.length === 0 && section.trainers[0]?.userId,
      );
      const section =
        untouched[testInfo.project.name.includes("iphone") ? 1 : 0];
      const to = (await transferCandidates(collegeId, [electrical.id], db))
        .get(electrical.id)
        ?.find(
          (candidate) =>
            !section.trainers.some(
              (trainer) => trainer.number === candidate.employeeNumber,
            ),
        );
      if (!to) throw new Error("e2e: no trainer to transfer the section to");

      const page = await signedIn(browser, {
        identifier: person.employeeNumber,
        password: person.password,
      });
      await page.goto("/sections");
      const card = page.getByRole("article", {
        name: t("section", { ref: section.ref }),
      });
      await card.getByRole("button", { name: text.transfer.button }).click();
      const sheet = page.getByRole("dialog", {
        name: t("transfer.title", { ref: section.ref }),
      });
      await sheet
        .getByRole("combobox", { name: text.transfer.to })
        .fill(to.employeeNumber);
      await page.getByRole("option", { name: to.name }).click();
      // From the term's first week, chosen by a finger on a phone: the long list of weeks scrolls
      // within the room it has (lead review C, M1).
      const weeks = sheet.getByRole("button", {
        name: new RegExp(`^${text.transfer.week}`),
      });
      await weeks.click();
      const first = page.getByRole("option", {
        name: t("transfer.weekOption", { week: 1 }),
        exact: true,
      });
      if (hasTouch) await first.tap();
      else await first.click();
      await expect(weeks).toHaveAccessibleName(
        `${text.transfer.week} ${t("transfer.weekOption", { week: 1 })}`,
      );
      await sheet.getByLabel(text.transfer.reason).fill("إعادة توزيع الأنصبة");
      await sheet
        .getByRole("button", { name: text.transfer.submit, exact: true })
        .click();
      const done = page.getByText(t("transfer.done", { ref: section.ref }));
      await expect(done).toBeVisible();
      await expect(card).toContainText(text.transfers.status.holds);
      await expect(card).toContainText(
        t("transfers.line", {
          week: 1,
          to: to.name,
          from: section.trainers[0]?.name ?? "",
        }),
      );
      // The toast lies over a phone's page while it shows: the checks look at the page drawn again.
      await page.reload();
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch) {
        expect(await smallTargets(page.locator("main"))).toEqual([]);
      }
      // The check wrote the page's Arabic in Latin letters.
      await page.reload();

      await card
        .getByRole("button", { name: text.transfers.cancel.button })
        .click();
      await page
        .getByRole("dialog", {
          name: t("transfers.cancel.title", { ref: section.ref }),
        })
        // The sheet's button names whom the section goes back to (UX review 2).
        .getByRole("button", {
          name: t("transfers.cancel.confirm", {
            from: section.trainers[0]?.name ?? "",
          }),
        })
        .click();
      await expect(page.getByText(text.transfers.cancel.done)).toBeVisible();
      await expect(card).not.toContainText(text.transfers.status.holds);
    } finally {
      await pool.query("delete from section_transfers where created_by = $1", [
        person.userId,
      ]);
      await pool.end();
    }
  },
);

test.describe("without the key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the sections page, and the shell offers none", async ({
    page,
  }) => {
    await page.goto("/sections");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: nav.sections })).toHaveCount(0);
  });
});
