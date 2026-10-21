import { randomInt, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import writeExcelFile from "write-excel-file/node";
import { defaultRoles } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { demo, STORAGE, signIn, signOut } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { confirmIfAsked, open, owned, signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { people: text, pages, nav, profile, auth } = messages;
// The catalog's plurals, in the digits the demo college keeps (the default).
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "people",
});
// The trainer role as the seed names it, never a literal: Step 43's profile seeds its roles from data.
const trainerRole =
  defaultRoles.find(({ key }) => key === "trainer")?.labels.ar ?? "";
const [, electrical, mechanical] = demoDepartments.map(({ name }) => name);
// Tests that make people in the database and remove them, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The people belong to whoever holds people.manage: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  return createDb(url).pool;
}

// A person's row in the list, found by their employee number.
async function find(page: Page, person: { employeeNumber: string }) {
  await page
    .getByRole("searchbox", { name: text.search.label })
    .fill(person.employeeNumber);
}

// Opens the account actions behind a person's row or on their page, and picks one.
async function act(page: Page, person: { name: string }, action: string) {
  await page
    .getByRole("button", {
      name: text.account.more.replace("{name}", person.name),
    })
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
}

// The sheet that confirms an account action.
const confirm = (page: Page, label: string) =>
  page.getByRole("dialog").getByRole("button", { name: label }).click();

const audited = async (entityId: string) =>
  (
    await database().query(
      "select action from audit_events where entity_id = $1 order by created_at",
      [entityId],
    )
  ).rows;

test(
  "a file of forty people is previewed without a write, then imported: an account each, its temporary password shown once, and the trainer role in its department",
  DATABASE,
  async ({ page }) => {
    const pool = database();
    const first = randomInt(800_000_000, 899_000_000);
    const numbers = Array.from({ length: 40 }, (_, index) =>
      String(first + index),
    );
    try {
      const columns = text.import.columns;
      const file = await writeExcelFile([
        [
          columns.employeeNumber,
          columns.name,
          columns.email,
          columns.department,
          columns.role,
        ],
        ...numbers.map((number, index) => [
          number,
          `منسوب مستورد ${index + 1}`,
          `import.${number}@oasis.example`,
          demoDepartments[index % demoDepartments.length].name,
          trainerRole,
        ]),
      ]).toBuffer();
      const imported = async () =>
        Number(
          (
            await pool.query(
              "select count(*) from people where employee_number = any($1)",
              [numbers],
            )
          ).rows[0].count,
        );

      await open(page, "/people/import");
      await page.getByLabel(text.import.file).setInputFiles({
        name: "people.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: file,
      });
      await page.getByRole("button", { name: text.import.preview }).click();

      // The preview: every row new, and nothing written yet.
      await expect(page.getByText(text.import.dryRun)).toBeVisible();
      await expect(
        page.getByText(`${text.import.outcomes.new}: 40`),
      ).toBeVisible();
      const plan = page.getByRole("table", {
        name: text.import.table.caption,
      });
      await expect(plan.locator("tbody tr")).toHaveCount(40);
      expect(await imported()).toBe(0);

      await page
        .getByRole("button", { name: t("import.confirm", { count: 40 }) })
        .click();
      // Imports take the college's lock in turn, so this one may wait for another project's.
      await confirmIfAsked(
        page,
        page.getByRole("heading", { name: text.import.result.title }),
        demo.adminPassword,
        30_000,
      );
      await expect(
        page.getByText(t("import.result.created", { count: 40 })),
      ).toBeVisible();
      const passwords = page
        .getByRole("list", { name: text.import.result.passwords })
        .getByRole("listitem");
      await expect(passwords).toHaveCount(40);

      expect(await imported()).toBe(40);
      const { rows } = await pool.query(
        `select p.employee_number, d.name as department, r.key as role,
           (select array_agg(e.action order by e.action) from audit_events e
            where e.entity_id in (p.user_id::text, m.id::text)) as events
         from people p
         join memberships m on m.user_id = p.user_id
         join roles r on r.id = m.role_id
         join departments d on d.id = m.department_id
         where p.employee_number = any($1) order by p.employee_number`,
        [numbers],
      );
      expect(rows).toEqual(
        numbers.map((number, index) => ({
          employee_number: number,
          department: demoDepartments[index % demoDepartments.length].name,
          role: "trainer",
          events: ["account.create", "membership.create"],
        })),
      );
    } finally {
      // Credentials, sessions and memberships go with each user; audit events stay.
      await pool.query(
        "delete from users where id in (select user_id from people where employee_number = any($1))",
        [numbers],
      );
      await pool.end();
    }
  },
);

test(
  "the preview gives each row with errors its reasons, and the import leaves those rows out",
  DATABASE,
  async ({ page }) => {
    const pool = database();
    const first = randomInt(600_000_000, 699_000_000);
    const numbers = [first, first + 1, first + 2].map(String);
    const name = (index: number) => `منسوب بأخطاء ${numbers[index]}`;
    try {
      const columns = text.import.columns;
      const file = await writeExcelFile([
        [
          columns.employeeNumber,
          columns.name,
          columns.email,
          columns.department,
          columns.role,
        ],
        [
          numbers[0],
          name(0),
          `ok.${numbers[0]}@oasis.example`,
          electrical,
          trainerRole,
        ],
        [numbers[1], name(1), "not-an-email", electrical, trainerRole],
        [
          numbers[2],
          name(2),
          `dept.${numbers[2]}@oasis.example`,
          "قسم لا تعرفه الكلية",
          trainerRole,
        ],
      ]).toBuffer();

      await open(page, "/people/import");
      await page.getByLabel(text.import.file).setInputFiles({
        name: "people.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: file,
      });
      await page.getByRole("button", { name: text.import.preview }).click();
      await expect(
        page.getByText(`${text.import.outcomes.invalid}: 2`),
      ).toBeVisible();
      const row = (index: number) =>
        page.getByRole("row").filter({ hasText: name(index) });
      await expect(row(1)).toContainText(text.import.errors.email);
      await expect(row(2)).toContainText(text.import.errors.department);
      // An unknown department is no place, not the whole college.
      await expect(row(2)).not.toContainText(text.college);

      await page
        .getByRole("button", { name: t("import.confirm", { count: 1 }) })
        .click();
      // Imports take the college's lock in turn, so this one may wait for another project's.
      await confirmIfAsked(
        page,
        page.getByRole("heading", { name: text.import.result.title }),
        demo.adminPassword,
        30_000,
      );
      await expect(
        page.getByText(t("import.result.skipped", { count: 2 })),
      ).toBeVisible();
      const { rows } = await pool.query(
        "select employee_number from people where employee_number = any($1)",
        [numbers],
      );
      expect(rows).toEqual([{ employee_number: numbers[0] }]);
    } finally {
      await pool.query(
        "delete from users where id in (select user_id from people where employee_number = any($1))",
        [numbers],
      );
      await pool.end();
    }
  },
);

test(
  "a head helps the trainers of their own department: a temporary password for one of them, and no one of another department",
  DATABASE,
  async ({ browser, account }) => {
    const own = await account({ trainerIn: electrical });
    const other = await account({ trainerIn: mechanical });
    const head = await signedIn(
      browser,
      {
        identifier: demoAccounts.head.employeeNumber,
        password: demo.password,
      },
      Buffer.from(demo.totpSecret),
    );
    await open(head, "/people");
    // The shell offers the page to a head too, for their department.
    await expect(head.getByRole("link", { name: nav.people })).toBeVisible();
    await expect(
      head.getByRole("link", { name: demoAccounts.trainer.name }),
    ).toBeVisible();
    await expect(
      head.getByRole("link", { name: demoAccounts.invitedTrainer.name }),
    ).toHaveCount(0);
    await find(head, other);
    await expect(
      head.getByText(
        messages.ui.search.none.replace("{query}", other.employeeNumber),
      ),
    ).toBeVisible();

    await find(head, own);
    await act(head, own, text.account.reset);
    await confirm(head, text.reset.confirm);
    const issued = head.getByText(
      text.temporaryPassword.label.replace("{name}", own.name),
    );
    await confirmIfAsked(head, issued, demo.password);
    const temporary = await head.locator("output").innerText();

    // The trainer signs in with it and replaces it before anything else.
    const trainer = await (
      await browser.newContext({ storageState: undefined })
    ).newPage();
    await trainer.goto("/");
    await signIn(trainer, {
      identifier: own.employeeNumber,
      password: temporary,
    });
    await expect(trainer).toHaveURL("/change-password");

    // Another department's trainer has no page for the head.
    await head.goto(`/people/${other.userId}`);
    await expect(
      head.getByRole("heading", { name: pages.notFound.title }),
    ).toBeVisible();

    const { rows } = await database().query(
      "select actor_id from audit_events where entity_id = $1 and action = 'account.resetPassword'",
      [own.userId],
    );
    expect(rows).toHaveLength(1);
  },
);

test(
  "an admin turns off the two-factor of someone who lost their phone, who then signs in with the password alone (ADR-0014)",
  DATABASE,
  async ({ page, browser, account }) => {
    const person = await account({ trainerIn: electrical });
    // As if they had set it up: signing in would ask them for a code.
    await database().query(
      "update users set two_factor_enabled = true where id = $1",
      [person.userId],
    );

    await open(page, `/people/${person.userId}`);
    await act(page, person, text.account.turnOffTwoFactor);
    await confirm(page, text.turnOffTwoFactor.confirm);
    await confirmIfAsked(
      page,
      page.getByText(text.turnOffTwoFactor.done.replace("{name}", person.name)),
      demo.adminPassword,
    );
    // Nothing is left to turn off.
    await page
      .getByRole("button", {
        name: text.account.more.replace("{name}", person.name),
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: text.account.turnOffTwoFactor,
        exact: true,
      }),
    ).toHaveCount(0);

    const trainer = await (
      await browser.newContext({ storageState: undefined })
    ).newPage();
    await trainer.goto("/");
    await signIn(trainer, {
      identifier: person.employeeNumber,
      password: person.password,
    });
    await expect(trainer).toHaveURL("/today");
    expect(await audited(person.userId)).toContainEqual({
      action: "account.disableTwoFactor",
    });
  },
);

test(
  "a disabled account cannot sign in until it is enabled again, and both changes are recorded",
  DATABASE,
  async ({ page, browser, account }) => {
    const person = await account();
    const disabledName = text.states.disabled;
    await open(page, `/people/${person.userId}`);
    await act(page, person, text.account.disable);
    await confirm(page, text.disable.confirm);
    await confirmIfAsked(
      page,
      page.getByText(text.disable.done.replace("{name}", person.name)),
      demo.adminPassword,
    );
    await expect(
      page.getByText(disabledName, { exact: true }).first(),
    ).toBeVisible();

    const visitor = await (
      await browser.newContext({ storageState: undefined })
    ).newPage();
    await visitor.goto("/");
    await signIn(visitor, {
      identifier: person.employeeNumber,
      password: person.password,
    });
    await expect(
      visitor.getByText(auth.signIn.disabled.title, { exact: true }),
    ).toBeVisible();
    await expect(visitor).toHaveURL("/");

    await act(page, person, text.account.enable);
    await confirm(page, text.enable.confirm);
    await confirmIfAsked(
      page,
      page.getByText(text.enable.done.replace("{name}", person.name)),
      demo.adminPassword,
    );
    await signIn(visitor, {
      identifier: person.employeeNumber,
      password: person.password,
    });
    await expect(visitor).toHaveURL("/today");

    // Beside the sign-ins, which the account's own events follow.
    expect(
      (await audited(person.userId))
        .map(({ action }) => action)
        .filter((action) => action.startsWith("account.")),
    ).toEqual(["account.disable", "account.enable"]);
  },
);

test(
  "one person added by hand gets a temporary password and their role in a department",
  DATABASE,
  async ({ page }) => {
    const pool = database();
    const employeeNumber = String(randomInt(700_000_000, 799_999_999));
    const name = `منسوب جديد ${employeeNumber}`;
    try {
      await open(page, "/people/new");
      await page.getByLabel(text.person.employeeNumber).fill(employeeNumber);
      await page.getByLabel(text.person.name, { exact: true }).fill(name);
      await page
        .getByLabel(text.person.email)
        .fill(`new.${employeeNumber}@oasis.example`);
      await page.getByRole("button", { name: text.new.role }).click();
      await page
        .getByRole("option", { name: trainerRole, exact: true })
        .click();
      await page.getByRole("button", { name: text.new.department }).click();
      await page.getByRole("option", { name: electrical, exact: true }).click();
      await page.getByRole("button", { name: text.new.create }).click();
      await confirmIfAsked(
        page,
        page.getByText(text.temporaryPassword.label.replace("{name}", name)),
        demo.adminPassword,
      );
      await expect(page.locator("output")).toHaveText(/\S{8,}/);

      const { rows } = await pool.query(
        `select r.key, d.name from people p join memberships m on m.user_id = p.user_id
         join roles r on r.id = m.role_id join departments d on d.id = m.department_id
         where p.employee_number = $1`,
        [employeeNumber],
      );
      expect(rows).toEqual([{ key: "trainer", name: electrical }]);
    } finally {
      await pool.query(
        "delete from users where id in (select user_id from people where employee_number = $1)",
        [employeeNumber],
      );
      await pool.end();
    }
  },
);

test.describe("the account menu", () => {
  test.use({ storageState: undefined });

  // Opens the menu that carries the person's name, once React owns it.
  async function menu(page: Page, person: TestAccount) {
    const trigger = page.getByRole("button", {
      name: auth.account.open.replace("{name}", person.name),
    });
    await expect
      .poll(() =>
        trigger.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
        ),
      )
      .toBe(true);
    await trigger.click();
  }

  test(
    "leads to the profile, and to changing the password, which the next sign-in takes",
    DATABASE,
    async ({ page, account }) => {
      const person = await account({ trainerIn: electrical });
      const fresh = `a-fresh-password-${randomUUID()}`;
      await page.goto("/");
      await signIn(page, {
        identifier: person.employeeNumber,
        password: person.password,
      });
      await expect(page).toHaveURL("/today");

      await menu(page, person);
      await page.getByRole("menuitem", { name: auth.account.profile }).click();
      await expect(page).toHaveURL("/profile");
      const details = page.getByRole("region", { name: profile.account });
      await expect(details).toContainText(person.name);
      await expect(details).toContainText(person.employeeNumber);
      await expect(details).toContainText(`${trainerRole} · ${electrical}`);

      await menu(page, person);
      await page
        .getByRole("menuitem", { name: auth.account.changePassword })
        .click();
      // Inside the shell, then back to the profile (UX review 1).
      await expect(page).toHaveURL("/profile/password");
      const { changePassword } = auth;
      await page.getByLabel(changePassword.current).fill(person.password);
      await page.getByLabel(changePassword.new, { exact: true }).fill(fresh);
      await page.getByLabel(changePassword.confirm).fill(fresh);
      await page.getByRole("button", { name: changePassword.submit }).click();
      await expect(page).toHaveURL("/profile");

      await signOut(page, person);
      await signIn(page, {
        identifier: person.employeeNumber,
        password: fresh,
      });
      await expect(page).toHaveURL("/today");
    },
  );
});

test.describe("without the people keys", () => {
  test.use({ storageState: STORAGE.trainer });

  test("the pages answer with the refusal, and the shell offers no people", async ({
    page,
  }) => {
    for (const path of [
      "/people",
      "/people/new",
      "/people/import",
      `/people/${randomUUID()}`,
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: pages.forbidden.title }),
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: nav.people })).toHaveCount(0);
  });

  test("the profile shows one's own account", async ({ page }) => {
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { level: 1, name: profile.title }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: profile.account }),
    ).toContainText(demoAccounts.trainer.employeeNumber);
  });
});

test("the people pages and the profile have no serious accessibility issue", async ({
  page,
}) => {
  await open(page, "/people");
  // Read before the check, which rewrites the page's Arabic letters.
  const trainer = await page
    .getByRole("link", { name: demoAccounts.trainer.name })
    .getAttribute("href");
  expect(await seriousViolations(page)).toEqual([]);
  for (const path of [
    trainer ?? "",
    "/people/new",
    "/people/import",
    "/profile",
  ]) {
    await page.goto(path);
    if (path !== "/profile") await owned(page);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control of the people pages and the profile has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/people");
    const trainer = await page
      .getByRole("link", { name: demoAccounts.trainer.name })
      .getAttribute("href");
    for (const path of [
      "/people",
      trainer ?? "",
      "/people/new",
      "/people/import",
      "/profile",
    ]) {
      await page.goto(path);
      if (path !== "/profile") await owned(page);
      // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
      await page.evaluate(() =>
        document.querySelector("nextjs-portal")?.remove(),
      );
      expect(await smallTargets(page.locator("main")), path).toEqual([]);
    }
  });
});
