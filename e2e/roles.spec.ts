import { randomUUID } from "node:crypto";
import { defaultRoles } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { createDb } from "../src/platform/db/client.ts";
import { test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { confirmIfAsked, open, owned, signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { roles: text, nav, pages, design } = messages;
// The trainer role as the seed names it, never a literal: Step 43's profile seeds its roles from data.
const trainerRole =
  defaultRoles.find(({ key }) => key === "trainer")?.labels.ar ?? "";
// Tests that make accounts and roles in the database and remove them, which the stack's smoke
// cannot reach.
const DATABASE = { tag: "@database" };

// The roles belong to whoever holds roles.manage: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

test(
  "a key given on the grid opens its page to the role's member at their next request, and taking it back closes it",
  DATABASE,
  async ({ browser, account }, testInfo) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { pool } = createDb(url);
    const name = `دور تجريبي ${testInfo.project.name} ${Date.now().toString(36)}`;
    const person = await account();
    try {
      const member = await signedIn(browser, {
        identifier: person.employeeNumber,
        password: person.password,
      });
      await member.goto("/design");
      await expect(
        member.getByRole("heading", { name: pages.notFound.title }),
      ).toBeVisible();

      const admin = await signedIn(
        browser,
        { identifier: demoAccounts.admin.email, password: demo.adminPassword },
        Buffer.from(demo.totpSecret),
      );
      await open(admin, "/roles/new");
      await admin
        .getByRole("textbox", { name: text.name.label, exact: true })
        .fill(name);
      await admin.getByRole("button", { name: text.new.create }).click();
      await expect(admin).toHaveURL(/\/roles\/[0-9a-f-]{36}$/);
      await expect(
        admin.getByRole("heading", { level: 1, name }),
      ).toBeVisible();
      await owned(admin);

      // The person, across the college.
      const combobox = admin.getByRole("combobox", {
        name: text.members.person,
      });
      await combobox.fill(person.employeeNumber);
      await admin.getByRole("option", { name: person.name }).click();
      await expect(combobox).toHaveValue(person.name);
      await admin.getByRole("button", { name: text.members.add }).click();
      await confirmIfAsked(
        admin,
        admin.getByText(
          text.members.toast.added.replace("{name}", person.name),
        ),
        demo.adminPassword,
      );
      await expect(
        admin.getByRole("list", { name: text.members.list }),
      ).toContainText(person.name);

      // The key, and the member's next request.
      const key = admin.getByRole("switch", {
        name: text.permissions.design.view.label,
      });
      const saved = admin.getByText(text.grid.toast.replace("{name}", name));
      await key.click();
      // The Save stays in view at the card's foot, however far down the key is (UX review 1).
      const save = admin.getByRole("button", { name: text.grid.save });
      await expect(save).toBeInViewport();
      await save.click();
      await confirmIfAsked(admin, saved, demo.adminPassword);
      await member.goto("/design");
      await expect(
        member.getByRole("heading", { level: 1, name: design.title }),
      ).toBeVisible();

      // Taken back: closed at the next request.
      await expect(saved).toBeHidden();
      await key.click();
      await admin.getByRole("button", { name: text.grid.save }).click();
      await confirmIfAsked(admin, saved, demo.adminPassword);
      await member.goto("/design");
      await expect(
        member.getByRole("heading", { name: pages.notFound.title }),
      ).toBeVisible();

      const { rows } = await pool.query(
        `select e.action, e.diff from audit_events e
         where e.entity_id in (
           select id::text from roles where labels->>'ar' = $1
           union select m.id::text from memberships m
             join roles r on r.id = m.role_id where r.labels->>'ar' = $1)
         order by e.created_at`,
        [name],
      );
      expect(rows.map(({ action }) => action)).toEqual([
        "role.create",
        "membership.create",
        "role.update",
        "role.update",
      ]);
      expect(rows.slice(2).map(({ diff }) => diff)).toEqual([
        { from: { permissions: [] }, to: { permissions: ["design.view"] } },
        { from: { permissions: ["design.view"] }, to: { permissions: [] } },
      ]);

      // Taking the role away asks first, in a sheet that names the person and the role.
      await admin
        .getByRole("button", {
          name: text.members.remove.replace("{name}", person.name),
        })
        .click();
      const sheet = admin.getByRole("dialog", {
        name: text.members.removeTitle
          .replace("{name}", person.name)
          .replace("{role}", name),
      });
      await sheet
        .getByRole("button", { name: text.members.removeConfirm })
        .click();
      await confirmIfAsked(
        admin,
        admin.getByText(
          text.members.toast.removed.replace("{name}", person.name),
        ),
        demo.adminPassword,
      );
      await expect(admin.getByText(text.members.empty)).toBeVisible();
    } finally {
      // The role's keys and memberships go with it; the person goes with the account fixture.
      await pool.query("delete from roles where labels->>'ar' = $1", [name]);
      await pool.end();
    }
  },
);

test("a new role needs a name, and one another role has is refused", async ({
  page,
}) => {
  await open(page, "/roles/new");
  const field = page.getByRole("textbox", {
    name: text.name.label,
    exact: true,
  });
  await page.getByRole("button", { name: text.new.create }).click();
  await expect(page.getByText(text.name.required)).toBeVisible();
  await field.fill(trainerRole);
  await page.getByRole("button", { name: text.new.create }).click();
  await expect(page.getByText(text.name.taken)).toBeVisible();
  await expect(page).toHaveURL("/roles/new");
});

test("an address that names no role of the college finds none", async ({
  page,
}) => {
  for (const id of ["not-a-role", randomUUID()]) {
    await page.goto(`/roles/${id}`);
    await expect(
      page.getByRole("heading", { name: pages.notFound.title }),
    ).toBeVisible();
  }
});

test("the roles and a role's page have no serious accessibility issue", async ({
  page,
}) => {
  await open(page, "/roles");
  // Read before the check, which rewrites the page's Arabic letters.
  const trainer = await page
    .getByRole("link", { name: trainerRole })
    .getAttribute("href");
  expect(await seriousViolations(page)).toEqual([]);
  await open(page, trainer ?? "");
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control of the list and of a role's page has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/roles");
    // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
    await page.evaluate(() =>
      document.querySelector("nextjs-portal")?.remove(),
    );
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    await page.getByRole("link", { name: trainerRole }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: trainerRole }),
    ).toBeVisible();
    await owned(page);
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });
});

test.describe("without roles.manage", () => {
  test.use({ storageState: STORAGE.trainer });

  test("the pages answer with the refusal, and the shell offers no roles", async ({
    page,
  }) => {
    for (const path of ["/roles", "/roles/new", `/roles/${randomUUID()}`]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: pages.forbidden.title }),
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: nav.roles })).toHaveCount(0);
  });
});
