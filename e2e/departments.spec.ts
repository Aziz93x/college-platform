import { randomUUID } from "node:crypto";
import type { Page, TestInfo } from "@playwright/test";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { createDb } from "../src/platform/db/client.ts";
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { departments: text, nav, pages, ui } = messages;
// Tests that read and clean up rows in the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The departments belong to whoever holds departments.manage and college.manage: the demo admin
// (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

// Waits until React owns the page's table or form: a press before that is lost.
async function owned(page: Page) {
  await page.waitForFunction(() => {
    const element = document.querySelector("main table, main form");
    return (
      element !== null &&
      Object.keys(element).some((key) => key.startsWith("__reactFiber$"))
    );
  });
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await owned(page);
}

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  return createDb(url).pool;
}

// The desktop and the phone run side by side on one database, so each names its departments.
const runOf = ({ project }: TestInfo) =>
  `${project.name} ${Date.now().toString(36)}`;

// By role, not by label: a page left by a navigation stays in the document, hidden, until the next
// one (React's Activity), and a role leaves out what is hidden.
const field = (page: Page, label: string) =>
  page.getByRole("textbox", { name: label, exact: true });
const rayatValue = (page: Page) =>
  page.getByRole("textbox", { name: text.form.rayatValuePlaceholder });

test(
  "an admin adds three departments on the screen, and their Rayat values and audit events are stored",
  DATABASE,
  async ({ page }, testInfo) => {
    const pool = database();
    const run = runOf(testInfo);
    const added = [1, 2, 3].map((number) => ({
      name: `قسم تجريبي ${number} ${run}`,
      shortName: `تجريبي ${number} ${run}`,
      rayatValues: [`تجريبي ${number} ${run}`, `قسم تجريبي ${number} ${run}`],
    }));
    try {
      for (const department of added) {
        await open(page, "/departments");
        await page.getByRole("link", { name: text.add, exact: true }).click();
        await expect(page).toHaveURL("/departments/new");
        await field(page, text.form.name).fill(department.name);
        await field(page, text.form.shortName).fill(department.shortName);
        const [first, last] = department.rayatValues;
        await rayatValue(page).fill(first);
        await rayatValue(page).press("Enter");
        await expect(
          page.getByRole("list", { name: text.form.rayatValues }),
        ).toContainText(first);
        // The last value stays in its field: the button adds it with the rest.
        await rayatValue(page).fill(last);
        await page.getByRole("button", { name: text.form.create }).click();
        await expect(
          page.getByText(
            text.form.toast.created.replace("{name}", department.name),
          ),
        ).toBeVisible();
        await expect(page).toHaveURL("/departments");
        await expect(
          page.getByRole("link", { name: department.name }),
        ).toBeVisible();
      }

      const { rows } = await pool.query(
        `select d.id, d.name, d.short_name, d.active, array_agg(v.value) as rayat_values
         from departments d join department_rayat_values v
           on v.department_id = d.id and v.college_id = d.college_id
         where d.name = any($1) group by d.id order by d.name`,
        [added.map(({ name }) => name)],
      );
      expect(
        rows.map(({ id: _id, rayat_values, ...row }) => ({
          ...row,
          rayat_values: rayat_values.sort(),
        })),
      ).toEqual(
        added.map(({ name, shortName, rayatValues }) => ({
          name,
          short_name: shortName,
          active: true,
          rayat_values: [...rayatValues].sort(),
        })),
      );
      const { rows: events } = await pool.query(
        `select e.entity_id, e.action, u.email, e.diff from audit_events e
         join users u on u.id::text = e.actor_id
         where e.entity_type = 'department' and e.entity_id = any($1)`,
        [rows.map(({ id }) => id)],
      );
      expect(events).toHaveLength(added.length);
      for (const { id, name } of rows) {
        const department = added.find((each) => each.name === name);
        expect(events.find(({ entity_id }) => entity_id === id)).toEqual({
          entity_id: id,
          action: "department.create",
          email: demoAccounts.admin.email,
          diff: {
            to: {
              ...department,
              rayatValues: [...(department?.rayatValues ?? [])].sort(),
              active: true,
            },
          },
        });
      }
    } finally {
      await pool.query("delete from departments where name = any($1)", [
        added.map(({ name }) => name),
      ]);
      await pool.end();
    }
  },
);

test(
  "a department renamed and set aside on its page shows its new name and state there and in the list",
  DATABASE,
  async ({ page }, testInfo) => {
    const pool = database();
    const run = runOf(testInfo);
    const name = `قسم للتعديل ${run}`;
    const renamed = `قسم معدل ${run}`;
    const {
      rows: [{ id }],
    } = await pool.query(
      `insert into departments (college_id, name, short_name)
       select id, $1, $2 from colleges order by created_at, id limit 1 returning id`,
      [name, `تعديل ${run}`],
    );
    try {
      await pool.query(
        `insert into department_rayat_values (college_id, department_id, value)
         select college_id, id, name from departments where id = $1`,
        [id],
      );
      await open(page, `/departments/${id}`);
      const header = page.locator("main header");
      await expect(header.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(header).toContainText(text.status.active);
      // Nothing changed yet: nothing to save.
      await expect(
        page.getByRole("button", { name: text.form.save }),
      ).toBeDisabled();

      await field(page, text.form.name).fill(renamed);
      await page.getByRole("switch", { name: text.form.active }).click();
      await page.getByRole("button", { name: text.form.save }).click();
      await expect(
        page.getByText(text.form.toast.saved.replace("{name}", renamed)),
      ).toBeVisible();
      // The page is drawn again: its title, its trail and its badge follow the saved department.
      await expect(header.getByRole("heading", { level: 1 })).toHaveText(
        renamed,
      );
      await expect(
        header.getByRole("navigation", { name: ui.trail }),
      ).toContainText(renamed);
      await expect(header).toContainText(text.status.inactive);
      const { rows } = await pool.query(
        `select action, diff from audit_events
         where entity_type = 'department' and entity_id = $1`,
        [id],
      );
      expect(rows).toEqual([
        {
          action: "department.update",
          diff: {
            from: { name, active: true },
            to: { name: renamed, active: false },
          },
        },
      ]);

      await header.getByRole("link", { name: text.title }).click();
      await expect(page).toHaveURL("/departments");
      await expect(
        page.getByRole("row").filter({ hasText: renamed }),
      ).toContainText(text.status.inactive);
    } finally {
      await pool.query("delete from departments where id = $1", [id]);
      await pool.end();
    }
  },
);

test("a new department needs its names and a Rayat value, and one another department has is refused", async ({
  page,
}, testInfo) => {
  const run = runOf(testInfo);
  const [general, electrical] = demoDepartments;
  await open(page, "/departments/new");
  await page.getByRole("button", { name: text.form.create }).click();
  for (const message of Object.values(text.form.required)) {
    await expect(page.getByText(message)).toBeVisible();
  }

  await field(page, text.form.name).fill(general.name);
  await field(page, text.form.shortName).fill(`مختصر ${run}`);
  await rayatValue(page).fill(`صيغة ${run}`);
  await page.getByRole("button", { name: text.form.create }).click();
  await expect(
    page.getByText(text.form.nameTaken.replace("{department}", general.name)),
  ).toBeVisible();

  await field(page, text.form.name).fill(`قسم ${run}`);
  await rayatValue(page).fill(electrical.rayatValues[0]);
  await rayatValue(page).press("Enter");
  await page.getByRole("button", { name: text.form.create }).click();
  await expect(
    page.getByText(
      text.form.valueTaken
        .replace("{value}", electrical.rayatValues[0])
        .replace("{department}", electrical.name),
    ),
  ).toBeVisible();
  await expect(page).toHaveURL("/departments/new");
});

test(
  "the college's short name saved on the screen is the one the phone's header shows, and is recorded",
  DATABASE,
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "iphone",
      "one college, renamed by one project: the phone's header shows its short name",
    );
    const pool = database();
    const {
      rows: [college],
    } = await pool.query(
      "select id, short_name from colleges order by created_at, id limit 1",
    );
    const renamed = `${college.short_name} ${Date.now().toString(36)}`;
    try {
      await open(page, "/departments");
      const form = page.getByRole("region", { name: text.college.title });
      await field(page, text.college.shortName).fill("");
      await form.getByRole("button", { name: text.college.save }).click();
      await expect(
        form.getByText(text.college.required.shortName),
      ).toBeVisible();

      await field(page, text.college.shortName).fill(renamed);
      await form.getByRole("button", { name: text.college.save }).click();
      await expect(page.getByText(text.college.toast)).toBeVisible();
      await expect(page.getByRole("banner")).toContainText(renamed);
      const { rows } = await pool.query(
        `select action, diff from audit_events
         where entity_type = 'college' and entity_id = $1
         order by created_at desc limit 1`,
        [college.id],
      );
      expect(rows).toEqual([
        {
          action: "college.update",
          diff: {
            from: { shortName: college.short_name },
            to: { shortName: renamed },
          },
        },
      ]);
    } finally {
      await pool.query("update colleges set short_name = $1 where id = $2", [
        college.short_name,
        college.id,
      ]);
      await pool.end();
    }
  },
);

test("an address that names no department of the college finds none", async ({
  page,
}) => {
  for (const id of ["not-a-department", randomUUID()]) {
    await page.goto(`/departments/${id}`);
    await expect(
      page.getByRole("heading", { name: pages.notFound.title }),
    ).toBeVisible();
  }
});

test("the departments and a department's page have no serious accessibility issue", async ({
  page,
}) => {
  await open(page, "/departments");
  // Read before the check, which rewrites the page's Arabic letters.
  const department = await page
    .getByRole("link", { name: demoDepartments[1].name })
    .getAttribute("href");
  expect(await seriousViolations(page)).toEqual([]);
  await open(page, department ?? "");
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control of the list and of a department's page has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/departments");
    // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
    await page.evaluate(() =>
      document.querySelector("nextjs-portal")?.remove(),
    );
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    await page.getByRole("link", { name: demoDepartments[0].name }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: demoDepartments[0].name }),
    ).toBeVisible();
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });
});

test.describe("without departments.manage", () => {
  test.use({ storageState: STORAGE.trainer });

  test("the pages answer with the refusal, and the shell offers no departments", async ({
    page,
  }) => {
    for (const path of [
      "/departments",
      "/departments/new",
      `/departments/${randomUUID()}`,
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: pages.forbidden.title }),
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: nav.departments })).toHaveCount(
      0,
    );
  });
});
