import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { assignmentCatalog } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { assignments: text, framework, pages, nav } = messages;
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "assignments",
});
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };
const title = (key: string) =>
  assignmentCatalog.find((each) => each.key === key)?.title ?? key;

// The head of Electrical, who holds assignment.manage there.
const asHead = (browser: Parameters<typeof signedIn>[0]) =>
  signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );
const card = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
// A week from a sheet's list of weeks, chosen by a finger on a phone.
async function chooseWeek(
  page: Page,
  sheet: Locator,
  label: string,
  week: number,
  hasTouch: boolean,
) {
  await sheet.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  const option = page.getByRole("option", {
    name: t("assign.weekOption", { week }),
    exact: true,
  });
  if (hasTouch) await option.tap();
  else await option.click();
}

test("the head of Electrical sees the six shared templates and the department's own, with whom each is given to this term, for which weeks, and the secretary's grant (Step 21)", async ({
  browser,
  hasTouch,
}) => {
  const page = await asHead(browser);
  await page.goto("/assignments");
  await expect(
    page.getByRole("heading", { level: 1, name: text.title }),
  ).toBeVisible();
  // Every department's six, then Electrical's own inventory officer.
  const titles = await page
    .locator("main")
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(titles.slice(0, 6)).toEqual(
    assignmentCatalog.map(({ title }) => title),
  );
  expect(titles).toContain("مسؤول العهد");

  const secretary = card(page, title("secretary"));
  await expect(secretary).toContainText(text.shared);
  await expect(secretary).toContainText(
    t("grants", { role: title("secretary") }),
  );
  await expect(secretary).toContainText(
    `${text.wholeTerm} · ${t("due", { week: 18 })}`,
  );
  // The schedule coordinator for the term's first four weeks, due in the fourth.
  await expect(card(page, title("schedule-coordinator"))).toContainText(
    `${t("range", { from: 1, to: 4 })} · ${t("due", { week: 4 })}`,
  );
  // The department's own template, with its three items in words.
  const own = card(page, "مسؤول العهد");
  await expect(own).toContainText(text.own);
  await expect(own).toContainText(t("items", { count: 3 }));
  await own.getByRole("button", { name: text.tasks }).click();
  for (const item of [
    "جرد عهد القسم وتحديث سجلاتها.",
    "تسجيل العهد الجديدة وتسليمها للمدربين.",
    "استلام العهد من المدربين في نهاية الفصل.",
  ]) {
    await expect(own.getByText(item)).toBeVisible();
  }
  // A shared template changes for no head.
  await expect(
    secretary.getByRole("button", {
      name: t("template.editLabel", { title: title("secretary") }),
    }),
  ).toHaveCount(0);

  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) {
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
});

test(
  "the head gives a template to two trainers at once for a range of weeks and revokes one, and the secretary's template gives its role while assigned (Step 21)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { pool } = createDb(url);
    try {
      const [first, second] = [
        await account({ trainerIn: demoDepartments[1].name }),
        await account({ trainerIn: demoDepartments[1].name }),
      ];
      const page = await asHead(browser);
      await page.goto("/assignments");

      const coordinator = title("cooperative-training-coordinator");
      const region = card(page, coordinator);
      await region
        .getByRole("button", {
          name: t("assign.label", { title: coordinator }),
        })
        .click();
      const sheet = page.getByRole("dialog", {
        name: t("assign.title", { title: coordinator }),
      });
      const search = sheet.getByRole("searchbox", {
        name: text.assign.search,
      });
      const list = sheet.getByRole("list", { name: text.assign.list });
      const box = (name: string) =>
        list.getByRole("checkbox", { name, exact: true });
      // Two at once: one found by employee number, the next by name, the first staying chosen
      // while the search hides them.
      await search.fill(first.employeeNumber);
      await box(first.name).click();
      await search.fill(second.name);
      await box(second.name).click();
      await expect(box(first.name)).toHaveCount(0);
      await expect(sheet).toContainText(t("assign.chosen", { count: 2 }));
      // Escape clears the search and keeps the sheet.
      await search.press("Escape");
      await expect(search).toHaveValue("");
      await expect(sheet).toBeVisible();
      for (const person of [first, second]) {
        await expect(box(person.name)).toBeChecked();
      }
      if (hasTouch) expect(await smallTargets(sheet)).toEqual([]);

      // From week 2 to week 10, its tasks due in the tenth.
      await sheet.getByRole("switch", { name: text.assign.wholeTerm }).click();
      await chooseWeek(page, sheet, text.assign.from, 2, hasTouch);
      await chooseWeek(page, sheet, text.assign.to, 10, hasTouch);
      await expect(sheet).toContainText(t("assign.due", { week: 10 }));
      await sheet
        .getByRole("button", { name: text.assign.submit, exact: true })
        .click();
      await expect(
        page.getByText(t("assign.done", { count: 2 })),
      ).toBeVisible();
      for (const person of [first, second]) {
        await expect(
          region.getByRole("listitem").filter({ hasText: person.name }),
        ).toContainText(
          `${t("range", { from: 2, to: 10 })} · ${t("due", { week: 10 })}`,
        );
      }

      // Revoked, after its sheet names the person and the template.
      await region
        .getByRole("button", {
          name: t("revoke.label", { name: first.name, title: coordinator }),
        })
        .click();
      await page
        .getByRole("dialog", {
          name: t("revoke.title", { name: first.name, title: coordinator }),
        })
        .getByRole("button", { name: text.revoke.button })
        .click();
      await expect(
        page.getByText(t("revoke.done", { name: first.name })),
      ).toBeVisible();
      await expect(region).not.toContainText(first.name);
      await expect(region).toContainText(second.name);

      // The secretary's template gives its role in Electrical for the term, and takes it back.
      const secretaryOf = async (userId: string) =>
        (
          await pool.query(
            `select m.term_id is not null as for_term from memberships m
             join roles r on r.id = m.role_id
             where m.user_id = $1 and r.key = 'secretary'`,
            [userId],
          )
        ).rows;
      const secretary = card(page, title("secretary"));
      await secretary
        .getByRole("button", {
          name: t("assign.label", { title: title("secretary") }),
        })
        .click();
      const grant = page.getByRole("dialog", {
        name: t("assign.title", { title: title("secretary") }),
      });
      await expect(grant).toContainText(
        t("assign.grants", { role: title("secretary") }),
      );
      await grant
        .getByRole("searchbox", { name: text.assign.search })
        .fill(second.employeeNumber);
      await grant
        .getByRole("list", { name: text.assign.list })
        .getByRole("checkbox", { name: second.name, exact: true })
        .click();
      await grant
        .getByRole("button", { name: text.assign.submit, exact: true })
        .click();
      await expect(
        page.getByText(t("assign.done", { count: 1 })),
      ).toBeVisible();
      expect(await secretaryOf(second.userId)).toEqual([{ for_term: true }]);
      await secretary
        .getByRole("button", {
          name: t("revoke.label", {
            name: second.name,
            title: title("secretary"),
          }),
        })
        .click();
      const revoke = page.getByRole("dialog", {
        name: t("revoke.title", {
          name: second.name,
          title: title("secretary"),
        }),
      });
      await expect(revoke).toContainText(
        t("revoke.grants", { role: title("secretary") }),
      );
      await revoke.getByRole("button", { name: text.revoke.button }).click();
      await expect(
        page.getByText(t("revoke.done", { name: second.name })),
      ).toBeVisible();
      expect(await secretaryOf(second.userId)).toEqual([]);
    } finally {
      await pool.end();
    }
  },
);

test("the sheet that assigns, with the department's people to tick, has no serious issue and 44 px targets on a phone (Step 21)", async ({
  browser,
  hasTouch,
}) => {
  const page = await asHead(browser);
  await page.goto("/assignments");
  const workshops = title("workshops-supervisor");
  await card(page, workshops)
    .getByRole("button", { name: t("assign.label", { title: workshops }) })
    .click();
  const sheet = page.getByRole("dialog", {
    name: t("assign.title", { title: workshops }),
  });
  const list = sheet.getByRole("list", { name: text.assign.list });
  await expect(list.getByRole("checkbox").first()).toBeVisible();
  await expect(
    sheet.getByRole("group", { name: text.assign.people }),
  ).toContainText(t("assign.chosen", { count: 0 }));
  if (hasTouch) expect(await smallTargets(sheet)).toEqual([]);
  // Last: the check writes the page's Arabic in Latin letters.
  expect(await seriousViolations(page)).toEqual([]);
});

test(
  "the head adds a template of the department's own, with its items' title, kind and evidence alone, renames it, and takes it out while unassigned (Step 21)",
  DATABASE,
  async ({ browser }) => {
    const page = await asHead(browser);
    await page.goto("/assignments");
    // One for each device, as they run side by side.
    const name = `مسؤول المختبرات ${randomInt(1000, 9999)}`;
    await page.getByRole("button", { name: text.template.add }).click();
    const added = page.getByRole("dialog", { name: text.template.addTitle });
    await added.getByLabel(text.template.name).fill(name);
    await added.getByRole("button", { name: text.template.save }).click();
    await expect(
      page.getByText(t("template.created", { title: name })),
    ).toBeVisible();
    const region = card(page, name);
    await expect(region).toContainText(text.own);
    await expect(region).toContainText(t("items", { count: 0 }));

    // An item: no axis, reach or due rule to choose, which the template and its assignment give.
    await region.getByRole("button", { name: text.tasks }).click();
    await region.getByRole("button", { name: text.item.add }).click();
    const sheet = page.getByRole("dialog", {
      name: t("item.addTitle", { title: name }),
    });
    await expect(sheet).not.toContainText(framework.fields.axis);
    await expect(sheet).not.toContainText(framework.fields.appliesTo);
    await expect(sheet).not.toContainText(framework.fields.due);
    await sheet.getByLabel(framework.fields.title).fill("جرد أجهزة المختبر");
    await sheet
      .getByRole("button", { name: framework.save, exact: true })
      .click();
    await expect(page.getByText(text.item.saved)).toBeVisible();
    await expect(region).toContainText("جرد أجهزة المختبر");

    await region
      .getByRole("button", {
        name: t("item.remove", { title: "جرد أجهزة المختبر" }),
      })
      .click();
    await page
      .getByRole("dialog", {
        name: t("item.removeTitle", { title: "جرد أجهزة المختبر" }),
      })
      .getByRole("button", { name: text.item.removeConfirm })
      .click();
    await expect(page.getByText(text.item.removed)).toBeVisible();

    const renamed = `${name} والورش`;
    await region
      .getByRole("button", { name: t("template.editLabel", { title: name }) })
      .click();
    const edit = page.getByRole("dialog", {
      name: t("template.editTitle", { title: name }),
    });
    await edit.getByLabel(text.template.name).fill(renamed);
    await edit.getByRole("button", { name: text.template.save }).click();
    await expect(page.getByText(text.template.saved)).toBeVisible();

    const kept = card(page, renamed);
    await kept
      .getByRole("button", {
        name: t("template.deleteLabel", { title: renamed }),
      })
      .click();
    await page
      .getByRole("dialog", {
        name: t("template.deleteTitle", { title: renamed }),
      })
      .getByRole("button", { name: text.template.delete })
      .click();
    await expect(
      page.getByText(t("template.deleted", { title: renamed })),
    ).toBeVisible();
    await expect(card(page, renamed)).toHaveCount(0);
  },
);

test(
  "a closed term's assignments are listed, with no one to assign and nothing to revoke (Step 21, Audit 7)",
  DATABASE,
  async ({ browser }) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { pool } = createDb(url);
    // A term of the test's own, closed, in which Electrical's demo trainer was its safety supervisor.
    const {
      rows: [term],
    } = await pool.query(
      `insert into terms (college_id, name, starts_on, weeks, status)
       select id, $1, '2021-01-03', 18, 'closed' from colleges order by created_at limit 1
       returning id, college_id`,
      [`فصل منتهٍ ${randomInt(100_000, 999_999)}`],
    );
    try {
      await pool.query(
        `insert into assignments (college_id, term_id, department_id, template_id, user_id)
         select $1, $2, d.id, t.id, p.user_id
         from departments d, assignment_templates t, people p
         where d.name = $3 and t.key = 'safety-supervisor' and p.employee_number = $4`,
        [
          term.college_id,
          term.id,
          demoDepartments[1].name,
          demoAccounts.trainer.employeeNumber,
        ],
      );
      const page = await asHead(browser);
      await page
        .context()
        .addCookies([
          { name: "term", value: term.id, url: new URL(page.url()).origin },
        ]);
      await page.goto("/assignments");
      await expect(page.getByText(text.closed)).toBeVisible();
      await expect(card(page, title("safety-supervisor"))).toContainText(
        demoAccounts.trainer.name,
      );
      await expect(
        page.getByRole("button", { name: /^تكليف منسوبين بـ/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^إلغاء تكليف/ }),
      ).toHaveCount(0);
    } finally {
      await pool.query("delete from assignments where term_id = $1", [term.id]);
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    }
  },
);

test.describe("without the key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the assignments page, and the shell offers none", async ({
    page,
  }) => {
    await page.goto("/assignments");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: nav.assignments })).toHaveCount(
      0,
    );
  });
});
