import { randomInt } from "node:crypto";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId, listDepartments } from "../src/modules/org/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { test } from "./support/accounts.ts";
import { demo } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { templates: text, framework } = messages;
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

test("the head of Electrical sees the framework's items for its trainers above the department's own templates (Step 18)", async ({
  browser,
  hasTouch,
}) => {
  const page = await signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );
  await page.goto("/templates");
  await expect(
    page.getByRole("heading", { level: 1, name: text.title }),
  ).toBeVisible();
  const college = page.getByRole("region", { name: text.college.title });
  await expect(college).toContainText("نسخة الاختبار ونموذج الإجابة");
  await expect(college.getByRole("button")).toHaveCount(0);
  const own = page.getByRole("region", { name: text.own.title });
  await expect(own.getByRole("listitem")).toHaveCount(7);
  await expect(own.getByRole("listitem").first()).toContainText(
    "نسخة الاختبار الفصلي ونموذج إجابته",
  );
  // An exam copy is a course's work: once for all its trainer's sections of it.
  await expect(own.getByRole("listitem").first()).toContainText(
    framework.eachCourse,
  );
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) expect(await smallTargets(page.locator("main"))).toEqual([]);
});

test(
  "a head adds a template for each course's trainers in their department, corrects it and takes it out (Step 18)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { db, pool } = createDb(url);
    const person = await account();
    // A draft term of the test's own, so the desktop and the phone, side by side, each have theirs.
    const collegeId = (await findCollegeId(db)) ?? "";
    const {
      rows: [term],
    } = await pool.query(
      "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2031-01-05', 18) returning id",
      [collegeId, `فصل القوالب ${randomInt(100_000, 999_999)}`],
    );
    try {
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
      // A draft term shows only to whoever manages terms (Step 13).
      await joinRole(
        { userId: person.userId, collegeId, role: { key: "vice-dean" } },
        db,
      );
      const page = await signedIn(browser, {
        identifier: person.employeeNumber,
        password: person.password,
      });
      await page
        .context()
        .addCookies([
          { name: "term", value: term.id, url: new URL(page.url()).origin },
        ]);
      await page.goto("/templates");
      await expect(
        page.getByRole("region", { name: text.college.title }),
      ).toContainText(text.college.notPublished);
      const own = page.getByRole("region", { name: text.own.title });
      await expect(own).toContainText(text.own.empty);
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch)
        expect(await smallTargets(page.locator("main"))).toEqual([]);
      // The check wrote the page's Arabic in Latin letters.
      await page.reload();

      await own.getByRole("button", { name: text.add }).click();
      const sheet = page.getByRole("dialog", { name: text.addTitle });
      await sheet.getByLabel(framework.fields.title).fill("عينات الواجبات");
      // A template reaches trainers, never a role: each section's, or each course's once for all
      // their sections of it.
      const reach = sheet.getByRole("button", {
        name: new RegExp(`^${framework.fields.appliesTo}`),
      });
      await reach.click();
      await expect(page.getByRole("option")).toHaveText([
        framework.eachSection,
        framework.eachCourse,
      ]);
      const perCourse = page.getByRole("option", {
        name: framework.eachCourse,
        exact: true,
      });
      if (hasTouch) await perCourse.tap();
      else await perCourse.click();
      await expect(reach).toHaveAccessibleName(
        `${framework.fields.appliesTo} ${framework.eachCourse}`,
      );
      const kind = sheet.getByRole("button", {
        name: new RegExp(`^${framework.fields.kind}`),
      });
      await kind.click();
      const homework = page.getByRole("option", {
        name: framework.kinds.homework,
        exact: true,
      });
      if (hasTouch) await homework.tap();
      else await homework.click();
      await expect(kind).toHaveAccessibleName(
        `${framework.fields.kind} ${framework.kinds.homework}`,
      );
      await sheet.getByRole("button", { name: framework.save }).click();
      await expect(page.getByText(text.saved)).toBeVisible();
      await expect(own.getByRole("listitem")).toHaveCount(1);
      await expect(own.getByRole("listitem")).toContainText(
        framework.kinds.homework,
      );
      await expect(own.getByRole("listitem")).toContainText(
        framework.eachCourse,
      );

      await own
        .getByRole("button", {
          name: text.edit.replace("{title}", "عينات الواجبات"),
        })
        .click();
      const editing = page.getByRole("dialog", { name: text.editTitle });
      await editing
        .getByLabel(framework.fields.title)
        .fill("ثلاث عينات من الواجبات");
      await editing.getByRole("button", { name: framework.save }).click();
      await expect(own.getByRole("listitem")).toContainText(
        "ثلاث عينات من الواجبات",
      );

      await own
        .getByRole("button", {
          name: text.remove.replace("{title}", "ثلاث عينات من الواجبات"),
        })
        .click();
      await expect(page.getByText(text.removed)).toBeVisible();
      await expect(own).toContainText(text.own.empty);
    } finally {
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    }
  },
);
