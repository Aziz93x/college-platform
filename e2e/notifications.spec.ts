import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { defaultRoles } from "../db/seed/base.ts";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { addMembership, listRoles } from "../src/modules/access/index.ts";
import { users } from "../src/modules/identity/index.ts";
import { notify } from "../src/modules/notifications/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { confirmIfAsked, open, signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { notifications: text, roles } = messages;
// The catalog's plurals, in the digits the demo college keeps (the default).
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "notifications",
});
// A role as the seed names it, never a literal: Step 43's profile seeds its roles from data.
const reviewer = defaultRoles.find(({ key }) => key === "quality-reviewer");
const reviewerRole = reviewer?.labels.ar ?? "";
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The panel under the bell, named by its heading.
const panel = (page: Page) =>
  page.getByRole("region", { name: text.panel, exact: true });

const bell = (page: Page) =>
  page.locator("header").getByRole("button", {
    name: new RegExp(`^${text.title}`),
  });

// The database the server under test uses, for what a test sets up there.
async function database<T>(
  work: (db: ReturnType<typeof createDb>["db"]) => Promise<T>,
) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  try {
    return await work(db);
  } finally {
    await pool.end();
  }
}

// The admin gives a person a role of the college, as the role's page does.
const giveRole = (person: TestAccount, key: string) =>
  database(async (db) => {
    const collegeId = (await findCollegeId(db)) ?? "";
    const role = (await listRoles(collegeId, db)).find(
      (candidate) => candidate.key === key,
    );
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, demoAccounts.admin.email));
    if (!role || !admin) throw new Error("e2e: run pnpm seed:demo first");
    return addMembership(
      { userId: person.userId, roleId: role.id, departmentId: null },
      { collegeId, actorId: admin.id },
      db,
    );
  });

const sendTo = (
  person: TestAccount,
  kind: "membershipAdded" | "membershipRemoved",
  role: string,
) =>
  database(async (db) =>
    notify(
      {
        collegeId: (await findCollegeId(db)) ?? "",
        userId: person.userId,
        kind,
        params: { role, scope: "college" },
      },
      db,
    ),
  );

// Opens a page of notifications once React owns its list or its switches: a press before that is lost.
async function visit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => {
    const element = document.querySelector(
      "main ol a, main [role=switch], main section",
    );
    return (
      element !== null &&
      Object.keys(element).some((key) => key.startsWith("__reactFiber$"))
    );
  });
}

const asPerson = (
  browser: Parameters<typeof signedIn>[0],
  person: TestAccount,
) =>
  signedIn(browser, {
    identifier: person.employeeNumber,
    password: person.password,
  });

test(
  "a role the admin gives reaches its holder's bell, whose panel leads to the center, and opening it reads it",
  DATABASE,
  async ({ browser, account }) => {
    const person = await account();
    const page = await asPerson(browser, person);
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 0 }));

    const admin = await signedIn(
      browser,
      { identifier: demoAccounts.admin.email, password: demo.adminPassword },
      Buffer.from(demo.totpSecret),
    );
    await open(admin, "/roles");
    await admin.getByRole("link", { name: reviewerRole }).click();
    const combobox = admin.getByRole("combobox", {
      name: roles.members.person,
    });
    await combobox.fill(person.employeeNumber);
    await admin.getByRole("option", { name: person.name }).click();
    await admin.getByRole("button", { name: roles.members.add }).click();
    await confirmIfAsked(
      admin,
      admin.getByText(roles.members.toast.added.replace("{name}", person.name)),
      demo.adminPassword,
    );

    // At the person's next page, the bell counts it and its panel shows it.
    const told = t("kinds.membershipAdded.title", {
      role: reviewerRole,
      scope: "college",
    });
    await page.reload();
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 1 }));
    await bell(page).click();
    await expect(panel(page)).toContainText(told);
    // A pointer opens the stack on its way in, a finger with the first tap; the next activation
    // leads to the center.
    const stack = panel(page).locator("button[aria-expanded]");
    await expect(stack).toHaveAccessibleName(t("stack.expand", { count: 1 }));
    await expect(async () => {
      await stack.click();
      await expect(page).toHaveURL("/notifications", { timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    // The center shows it unread; opening it reads it and goes to the profile, where roles show.
    const item = page.getByRole("link").filter({ hasText: told });
    await expect(item).toContainText(text.unread);
    await item.click();
    await expect(page).toHaveURL("/profile");
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 0 }));
    await page.goto("/notifications");
    await expect(item).not.toContainText(text.unread);
  },
);

test(
  "a kind turned off in the preferences reaches the person no more, and turned on again, it does",
  DATABASE,
  async ({ browser, account }) => {
    const person = await account();
    const page = await asPerson(browser, person);
    await visit(page, "/notifications/preferences");
    const added = page.getByRole("switch", {
      name: text.kinds.membershipAdded.label,
    });
    await expect(added).toHaveAttribute("aria-checked", "true");
    await added.click();
    await expect(
      page.getByText(
        t("preferences.saved", { kind: text.kinds.membershipAdded.label }),
      ),
    ).toBeVisible();
    await expect(added).toHaveAttribute("aria-checked", "false");

    expect((await giveRole(person, "quality-reviewer")).status).toBe("added");
    await page.reload();
    await expect(added).toHaveAttribute("aria-checked", "false");
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 0 }));

    // Turned on again once the choice is saved, which its toast says.
    await added.click();
    await expect(added).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByText(
        t("preferences.saved", { kind: text.kinds.membershipAdded.label }),
      ),
    ).toBeVisible();
    expect((await giveRole(person, "secretary")).status).toBe("added");
    await page.reload();
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 1 }));
  },
);

test(
  "marking everything read empties the bell, and the center keeps the notifications",
  DATABASE,
  async ({ browser, account }) => {
    const person = await account();
    await sendTo(person, "membershipAdded", "first");
    await sendTo(person, "membershipRemoved", "second");
    const page = await asPerson(browser, person);
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 2 }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await visit(page, "/notifications");
    await expect(page.locator("main ol > li")).toHaveCount(2);
    // Two unread rows, whatever the demo data holds, for the contrast check (Audit 4). Axe reads the
    // page with its Arabic made Latin, so the page is opened again before it is used.
    expect(await seriousViolations(page)).toEqual([]);
    await visit(page, "/notifications");
    await page.getByRole("button", { name: text.markAllRead }).click();
    await expect(page.getByText(text.markedAllRead)).toBeVisible();
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 0 }));
    await expect(page.locator("main ol > li")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: text.markAllRead }),
    ).toHaveCount(0);
  },
);

test.describe("the demo trainer", () => {
  test.use({ storageState: STORAGE.trainer });

  test("on a phone the bell stays in the header, and its panel opens there", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the phone's header");
    await page.goto("/today");
    await expect(bell(page)).toBeVisible();
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText(text.stack.empty);
  });

  test("the center, the preferences and the bell's panel have no serious accessibility issue", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await visit(page, "/notifications/preferences");
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto("/notifications");
    await expect(page.locator("main ol > li").first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    // The stack loads with the panel; axe reads it once it has drawn its words.
    await bell(page).click();
    await expect(panel(page)).toContainText(text.stack.empty);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test.describe("touch targets", () => {
    test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

    test("every enabled control of the center, the preferences and the panel has a 44 px hit area", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const path of ["/notifications", "/notifications/preferences"]) {
        await visit(page, path);
        // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
        await page.evaluate(() =>
          document.querySelector("nextjs-portal")?.remove(),
        );
        expect(await smallTargets(page.locator("main")), path).toEqual([]);
      }
      // The header with the bell, then the bell's panel.
      expect(await smallTargets(page.getByRole("banner"))).toEqual([]);
      await bell(page).click();
      await expect(panel(page)).toContainText(text.stack.empty);
      expect(await smallTargets(panel(page))).toEqual([]);
    });
  });
});
