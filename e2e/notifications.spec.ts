import type { Locator, Page } from "@playwright/test";
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

// What sendTo's notifications are sent with, for their words.
const firstRole = { role: "first", scope: "college" } as const;

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

// A tap where the phone has a finger, a click elsewhere.
const press = (target: Locator, touch: boolean) =>
  touch ? target.tap() : target.click();

test(
  "a role the admin gives reaches its holder's bell, where its card opens it and reads it (ADR-0015)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
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

    // At the person's next page, the bell counts it, and one tap on its card in the panel opens
    // the page it is about, the profile, where roles show, and reads it.
    const told = t("kinds.membershipAdded.title", {
      role: reviewerRole,
      scope: "college",
    });
    await page.reload();
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 1 }));
    await press(bell(page), hasTouch);
    await press(
      panel(page).getByRole("link").filter({ hasText: told }),
      hasTouch,
    );
    await expect(page).toHaveURL("/profile");
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 0 }));
    // The center's rows, in the page: the bell's panel may still be fading out above them.
    await visit(page, "/notifications");
    await expect(
      page.locator("main").getByRole("link").filter({ hasText: told }),
    ).not.toContainText(text.unread);
  },
);

test(
  "the stack's foot opens the list of the newest, then leads to the center, whose row opens one and reads it",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const person = await account();
    await sendTo(person, "membershipAdded", "first");
    await sendTo(person, "membershipRemoved", "second");
    const page = await asPerson(browser, person);
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 2 }));
    await press(bell(page), hasTouch);
    const foot = panel(page).locator("button[aria-expanded]");
    await expect(foot).toHaveAccessibleName(t("stack.expand", { count: 2 }));
    // Closed, the card behind the newest shows only its edge.
    const older = panel(page)
      .getByRole("link")
      .filter({ hasText: t("kinds.membershipAdded.title", firstRole) });
    await expect(older).toBeHidden();

    // A finger opens the list with a tap on the foot, a pointer on its way in.
    if (hasTouch) await foot.tap();
    else await foot.hover();
    await expect(foot).toHaveAttribute("aria-expanded", "true");
    await expect(foot).toHaveAccessibleName(t("stack.open", { count: 2 }));
    await expect(older).toBeVisible();
    if (hasTouch) expect(await smallTargets(panel(page))).toEqual([]);
    await expect(async () => {
      await press(foot, hasTouch);
      await expect(page).toHaveURL("/notifications", { timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    // The foot read nothing; the center's row opens its page and reads it.
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 2 }));
    const item = page
      .locator("main")
      .getByRole("link")
      .filter({ hasText: t("kinds.membershipAdded.title", firstRole) });
    await expect(item).toContainText(text.unread);
    await item.click();
    await expect(page).toHaveURL("/profile");
    await expect(bell(page)).toHaveAccessibleName(t("bell", { count: 1 }));
  },
);

test(
  "the keyboard opens the stack as its focus comes in, and Escape closes the stack before the panel",
  DATABASE,
  async ({ browser, account, isMobile }) => {
    test.skip(isMobile, "the desktop's keyboard");
    const person = await account();
    await sendTo(person, "membershipAdded", "first");
    await sendTo(person, "membershipRemoved", "second");
    const page = await asPerson(browser, person);
    await bell(page).click();
    const foot = panel(page).locator("button[aria-expanded]");
    const card = (
      kind: "membershipAdded" | "membershipRemoved",
      role: string,
    ) =>
      panel(page)
        .getByRole("link")
        .filter({
          hasText: t(`kinds.${kind}.title`, { role, scope: "college" }),
        });
    await expect(foot).toHaveAttribute("aria-expanded", "false");

    // From the bell: "mark all read", then the newest card, which opens the list.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(card("membershipRemoved", "second")).toBeFocused();
    await expect(foot).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(card("membershipAdded", "first")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(foot).toHaveAttribute("aria-expanded", "false");
    await expect(foot).toBeFocused();
    await expect(panel(page)).toBeVisible();
    // The foot opens the list, then leads to the center.
    await page.keyboard.press("Enter");
    await expect(foot).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/notifications");
  },
);

test(
  "the bell's stack has no serious accessibility issue, closed or open",
  DATABASE,
  async ({ browser, account }) => {
    const person = await account();
    await sendTo(person, "membershipAdded", "first");
    await sendTo(person, "membershipRemoved", "second");
    const page = await asPerson(browser, person);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bell(page).click();
    const foot = panel(page).locator("button[aria-expanded]");
    await expect(foot).toHaveAttribute("aria-expanded", "false");
    expect(await seriousViolations(page)).toEqual([]);
    // Axe reads the page with its Arabic made Latin, so the page is opened again before it is used.
    await page.reload();
    await bell(page).click();
    await foot.hover();
    await expect(foot).toHaveAttribute("aria-expanded", "true");
    // A card under the pointer is tinted, and its muted words keep their contrast on it.
    await panel(page).getByRole("link").last().hover();
    expect(await seriousViolations(page)).toEqual([]);
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
