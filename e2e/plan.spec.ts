import { randomInt } from "node:crypto";
import type { Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { defaultRoles, portfolioAxes } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId, listDepartments } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { modelledPerson } from "./support/model.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { plan: text, framework, nav, pages } = messages;
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The plan's words with their plurals, in the college's digits.
const plural = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "plan",
});
// The words of a message with its values in place.
const t = (message: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (words, [name, value]) => words.replaceAll(`{${name}}`, String(value)),
    message,
  );
const mark = (title: string, week: number) =>
  t(text.grid.mark, { title, week });
// How far the page scrolls sideways.
const sideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

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
  // What publishing the draft creates, and the reviews it asks of the head each week, with the week
  // that asks the most: the exam weeks ask far more than the average (Audit 7).
  await expect(page.getByText(/^تُنشئ المسودة/)).toBeVisible();
  await expect(page.getByText(/في الأسبوع:/)).toBeVisible();
  await expect(page.getByText(/أكثرها في الأسبوع [\d٠-٩]+: /)).toBeVisible();
  if (hasTouch) {
    // On a phone, a list by week: the lab reports a week earlier than version 1's, in week 11.
    const week = page.getByRole("region", {
      name: t(text.list.week, { week: 11 }),
      exact: true,
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
    page.getByRole("region", { name: text.versions.title, exact: true }),
  ).toContainText(/النسخة 1 · نُشرت/);
  expect(await seriousViolations(page)).toEqual([]);
  if (hasTouch) expect(await smallTargets(page.locator("main"))).toEqual([]);
});

test("on a tablet and a laptop, the plan's grid keeps its week row and its selection's bar in view, and the page never scrolls sideways (UX review 2)", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "The grid is for wide screens.");
  const page = await signedIn(
    browser,
    { identifier: demoAccounts.head.employeeNumber, password: demo.password },
    Buffer.from(demo.totpSecret),
  );
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/plan");
    const grid = page.getByRole("table", { name: text.grid.label });
    await expect(grid).toBeVisible();
    expect(await sideways(page)).toBe(0);
    // Scrolled to its last row, and the page with it as far as the grid's foot.
    await page
      .getByRole("region", { name: text.grid.label })
      .evaluate((frame) => {
        frame.scrollTop = frame.scrollHeight;
        frame.scrollIntoView({ block: "end" });
      });
    const week = grid.getByRole("columnheader", {
      name: t(text.grid.week, { week: 1 }),
      exact: true,
    });
    await expect(week).toBeInViewport();
    const header = await page.getByRole("banner").boundingBox();
    expect((await week.boundingBox())?.y).toBeGreaterThanOrEqual(
      (header?.y ?? 0) + (header?.height ?? 0) - 1,
    );
    // The last item chosen, the bar that acts on it is in view whole.
    await grid.getByRole("checkbox").last().click();
    await expect(
      page.getByRole("toolbar", { name: text.selection.label }),
    ).toBeInViewport({ ratio: 1 });
  }
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
      // Save stays in reach under the sheet's fields (UX review 2).
      const save = sheet.getByRole("button", {
        name: framework.save,
        exact: true,
      });
      await expect(save).toBeInViewport({ ratio: 1 });
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
      // Clear of the sheet's actions, so the next item saves at once (UX review 2): a toast over
      // them took the click, and the pointer resting on it kept it there.
      await sheet
        .getByRole("button", { name: framework.saveAndAdd })
        .click({ trial: true, timeout: 2_000 });
      await expect(sheet.getByLabel(framework.fields.title)).toHaveValue("");
      await expect(save).toBeInViewport({ ratio: 1 });
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
      await save.click();
      await expect(sheet).toBeHidden();
      // Taking one item out asks first, in a sheet that names it, as the framework's does
      // (UX review 2).
      await page
        .getByRole("button", {
          name: t(text.remove, { title: "تقرير الأسبوع الثالث" }),
        })
        .click();
      const removing = page.getByRole("dialog", {
        name: `حذف «تقرير الأسبوع الثالث» من المسودة`,
      });
      await expect(removing).toBeVisible();
      await removing.getByRole("button", { name: messages.ui.cancel }).click();
      await expect(removing).toBeHidden();

      if (!hasTouch) {
        const grid = page.getByRole("table", { name: text.grid.label });
        // A mark moves a week with the arrow keys: in Arabic the next week is to the left.
        await grid
          .getByRole("button", { name: mark("محضر لجنة الجودة", 1) })
          .press("ArrowLeft");
        await expect(
          grid.getByRole("button", { name: mark("محضر لجنة الجودة", 2) }),
        ).toBeFocused();
        // And by dragging it along its row, to the fifth week, mid-screen, clear of the saved
        // item's toast at the screen's foot.
        const row = grid
          .getByRole("row")
          .filter({ hasText: "تقرير الأسبوع الثالث" });
        await row.evaluate((element) =>
          element.scrollIntoView({ block: "center" }),
        );
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
          page.getByRole("region", {
            name: t(text.list.week, { week: 3 }),
            exact: true,
          }),
        ).toContainText("تقرير الأسبوع الثالث");
      }

      await page.getByRole("button", { name: text.publish }).click();
      const publishing = page.getByRole("dialog", {
        name: t(text.publishTitle, { version: 1 }),
      });
      // One task: the minutes reach the head once, and the weekly report no one, since SS01 has
      // given the new term no sections yet (Audit 7, minor 5).
      await expect(
        publishing.getByText(plural("impact", { tasks: 1 }), { exact: true }),
      ).toBeVisible();
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
        page.getByRole("region", { name: text.versions.title, exact: true }),
      ).toContainText(/النسخة 1 · نُشرت .* · بندان/);
    } finally {
      await made.remove();
    }
  },
);

test(
  "someone whose role holds plan.publish alone reads the department's draft with its preview, and publishes it, with nothing to add, move or start (ADR-0027, Audit 7)",
  DATABASE,
  async ({ browser, account }) => {
    const made = await headWithDraftTerm(account);
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { db, pool } = createDb(url);
    const key = `publisher-${randomInt(100_000, 999_999)}`;
    try {
      // The head starts the plan with one item.
      const head = await onTerm(browser, made.person, made.termId);
      await head.getByRole("button", { name: text.start }).click();
      await head.getByRole("button", { name: text.add }).click();
      const sheet = head.getByRole("dialog", { name: text.addTitle });
      await sheet.getByLabel(framework.fields.title).fill("محضر لجنة الجودة");
      await sheet
        .getByRole("button", { name: framework.save, exact: true })
        .click();
      await expect(sheet).toBeHidden();
      await head.context().close();

      // A role of the test's own that holds plan.publish alone, held in General Studies.
      const publisher = await account();
      const collegeId = (await findCollegeId(db)) ?? "";
      const general = (await listDepartments(collegeId, db)).find(
        ({ name }) => name === demoDepartments[0].name,
      );
      const {
        rows: [role],
      } = await pool.query(
        "insert into roles (college_id, key, labels) values ($1, $2, $3) returning id",
        [collegeId, key, JSON.stringify({ ar: "ناشر خطط الأقسام" })],
      );
      await pool.query(
        "insert into role_permissions (role_id, permission) values ($1, 'plan.publish')",
        [role.id],
      );
      await pool.query(
        "insert into memberships (user_id, role_id, college_id, department_id) values ($1, $2, $3, $4)",
        [publisher.userId, role.id, collegeId, general?.id],
      );

      const page = await onTerm(browser, publisher, made.termId);
      expect(
        await page.getByRole("link", { name: nav.plan }).count(),
      ).toBeGreaterThan(0);
      await expect(
        page.getByRole("heading", {
          name: t(text.status.draft, { version: 1 }),
        }),
      ).toBeVisible();
      // The draft's preview: its one item reaches each section's trainer, and the new term has no
      // sections yet.
      await expect(
        page.getByText(plural("impact", { tasks: 0 }), { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: text.add })).toHaveCount(0);
      await page.getByRole("button", { name: text.publish }).click();
      await page
        .getByRole("dialog", { name: t(text.publishTitle, { version: 1 }) })
        .getByRole("button", { name: text.publishConfirm })
        .click();
      await expect(
        page.getByRole("heading", { name: /^النسخة 1 منشورة منذ/ }),
      ).toBeVisible();
      // The next version is the editor's to start.
      await expect(page.getByText(text.needsEditor)).toBeVisible();
      await expect(
        page.getByRole("button", { name: t(text.newVersion, { version: 2 }) }),
      ).toHaveCount(0);
    } finally {
      await pool.query("delete from roles where key = $1", [key]);
      await pool.end();
      await made.remove();
    }
  },
);

// A department's term plan of 50 items, as a head enters it: the kinds of Electrical's demo plan,
// ten of each, each item with its own title and week, and the first of each kind setting its axis,
// kind, reach, evidence and approval, which the sheet keeps for the next (Step 19, Audit 7).
const axisOption = (code: string) =>
  t(framework.axisOption, {
    code,
    title:
      portfolioAxes
        .flatMap(({ axes }) => axes)
        .find((axis) => axis.code === code)?.title ?? "",
  });
const roleOption = (key: string) =>
  defaultRoles.find((role) => role.key === key)?.labels.ar ?? key;
const KINDS = [
  {
    title: "تقرير التجربة العملية",
    axis: "5",
    kind: framework.kinds.homework,
    reach: framework.eachSection,
    type: "JPG",
    files: 3,
    approval: false,
  },
  {
    title: "نسخة الاختبار العملي",
    axis: "2",
    kind: framework.kinds.exam_copy,
    reach: framework.eachCourse,
    type: "DOCX",
    files: 2,
    approval: true,
  },
  {
    title: "قائمة التحقق من سلامة الورشة",
    axis: "6",
    kind: framework.kinds.general,
    reach: framework.eachSection,
    type: "JPG",
    files: 2,
    approval: false,
  },
  {
    title: "محضر اجتماع القسم",
    axis: "9",
    kind: framework.kinds.meeting_minutes,
    reach: roleOption("secretary"),
    type: "DOCX",
    files: 1,
    approval: false,
  },
  {
    title: "زيارة صفية متبادلة",
    axis: "4",
    kind: framework.kinds.professional_development,
    reach: roleOption("trainer"),
    type: "PDF",
    files: 1,
    approval: true,
  },
];

test(
  "a head builds a 50-item plan of five kinds, each item its own week, in under 30 minutes by the keystroke-level model (Step 19's usability run)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    test.skip(hasTouch, "Timed once, on the desktop.");
    // About a minute on a build; a run that stalls fails within CI's job, retry and all.
    test.setTimeout(4 * 60_000);
    const made = await headWithDraftTerm(account);
    try {
      const started = Date.now();
      const page = await onTerm(browser, made.person, made.termId);
      const head = modelledPerson((label, option) =>
        choose(page, label, option, hasTouch),
      );
      await head.click(page.getByRole("button", { name: text.start }));
      await head.click(page.getByRole("button", { name: text.add }));
      const sheet = page.getByRole("dialog", { name: text.addTitle });
      const title = sheet.getByLabel(framework.fields.title);
      const stepper = (field: string) =>
        sheet.getByRole("group", { name: field, exact: true });
      // What the sheet holds, as the head sees it: it starts a new item at week 1, with one file of
      // the first accepted type, and keeps all but the title for the next.
      const held = { week: 1, files: 1, approval: false };
      const toValue = async (field: string, from: number, to: number) => {
        if (from === to) return;
        await head.step(
          stepper(field).getByRole("button", {
            name: to > from ? framework.more : framework.fewer,
          }),
          Math.abs(to - from),
        );
      };
      for (const [group, kind] of KINDS.entries()) {
        for (let at = 0; at < 10; at++) {
          await head.type(title, `${kind.title} ${at + 1}`);
          if (at === 0) {
            await head.choose(framework.fields.axis, axisOption(kind.axis));
            await head.choose(framework.fields.kind, kind.kind);
            await head.choose(framework.fields.appliesTo, kind.reach);
            // Its file type alone, the boxes taken all at once: a list of the ticked ones would
            // shrink under the clicks.
            const types = sheet.getByRole("group", {
              name: framework.fields.types,
            });
            for (const box of await types.getByRole("checkbox").all()) {
              const name = await box.evaluate(
                (each) =>
                  document.getElementById(
                    each.getAttribute("aria-labelledby") ?? "",
                  )?.textContent,
              );
              const ticked =
                (await box.getAttribute("aria-checked")) === "true";
              if (ticked !== (name === kind.type)) await head.click(box);
            }
            await expect(
              types.getByRole("checkbox", { checked: true }),
            ).toHaveCount(1);
            await toValue(framework.fields.maxFiles, held.files, kind.files);
            held.files = kind.files;
            if (held.approval !== kind.approval) {
              await head.click(
                sheet.getByRole("switch", { name: framework.fields.approval }),
              );
              held.approval = kind.approval;
            }
          }
          // Each kind spreads over the term from its own week.
          const week = 1 + ((group * 3 + at) % 18);
          await toValue(framework.fields.week, held.week, week);
          held.week = week;
          await head.click(
            sheet.getByRole("button", { name: framework.saveAndAdd }),
          );
          await expect(title).toHaveValue("");
        }
      }
      await head.click(sheet.getByRole("button", { name: messages.ui.cancel }));
      const grid = page.getByRole("table", { name: text.grid.label });
      await expect(grid.getByRole("checkbox")).toHaveCount(51);
      // The sheet kept each kind's choices for its other nine items, as the model counts on.
      for (const kind of KINDS) {
        await expect(
          grid.getByRole("row").filter({ hasText: `${kind.title} 10` }),
        ).toContainText(kind.reach);
      }
      await head.click(page.getByRole("button", { name: text.publish }));
      await head.click(
        page
          .getByRole("dialog", { name: t(text.publishTitle, { version: 1 }) })
          .getByRole("button", { name: text.publishConfirm }),
      );
      await expect(
        page.getByRole("heading", { name: /^النسخة 1 منشورة منذ/ }),
      ).toBeVisible();
      // A head's time by the model is within the step's 30 minutes; the scripted run itself has a
      // bound that it can fail, well inside its timeout.
      const minutes = head.seconds() / 60;
      test.info().annotations.push({
        type: "modelled time",
        description: `${minutes.toFixed(1)} minutes for 50 items`,
      });
      expect(minutes).toBeLessThan(30);
      expect(Date.now() - started).toBeLessThan(3 * 60_000);
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
