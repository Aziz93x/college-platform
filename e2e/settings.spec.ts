import type { Page, TestInfo } from "@playwright/test";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { createDb } from "../src/platform/db/client.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { settings: text, nav, pages, reauth, today } = messages;
// Tests that change the demo admin's session in the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The settings belong to whoever holds settings.manage: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

// A setting's row: its form, named by its heading.
const row = (page: Page, label: string) =>
  page.locator("form").filter({
    has: page.getByRole("heading", { name: label, exact: true }),
  });

// Opens the screen on a group and waits until React owns it: a press before that is lost.
async function open(page: Page, group?: string) {
  await page.goto(group ? `/settings?group=${group}` : "/settings");
  await page.waitForFunction(() => {
    const tabs = document.querySelector('[role="tablist"]');
    return (
      tabs !== null &&
      Object.keys(tabs).some((key) => key.startsWith("__reactFiber$"))
    );
  });
}

// The desktop and the phone run side by side on one database, so each changes a setting of its own.
const countFor = ({ project }: TestInfo) =>
  project.name === "desktop"
    ? {
        group: "review" as const,
        label: text.fields.review.weeklyCap.label,
        from: 30,
      }
    : {
        group: "files" as const,
        label: text.fields.files.maxSizeMb.label,
        from: 20,
      };

test("the groups are tabs, the one on show is kept in the address, and search looks across them all", async ({
  page,
}) => {
  await open(page);
  const tabs = page.getByRole("tablist", { name: text.groupsLabel });
  await expect(tabs.getByRole("tab")).toHaveCount(
    Object.keys(text.groups).length,
  );
  for (const group of Object.values(text.groups)) {
    await expect(tabs.getByRole("tab", { name: group })).toBeAttached();
  }
  await expect(
    tabs.getByRole("tab", { name: text.groups.platform, selected: true }),
  ).toBeVisible();

  await tabs.getByRole("tab", { name: text.groups.security }).click();
  await expect(page).toHaveURL(/[?&]group=security\b/);
  await expect(
    page.getByRole("heading", { name: text.fields.auth.lockoutMinutes.label }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: text.groups.security, selected: true }),
  ).toBeVisible();

  // Words written with or without the article, from two groups at once.
  const search = page.getByRole("searchbox", { name: text.search.label });
  await search.fill("كلمة المرور");
  await expect(tabs).toBeHidden();
  await expect(
    page.getByRole("heading", {
      name: text.fields.auth.passwordMinLength.label,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: text.fields.auth.reauthMinutes.label }),
  ).toBeVisible();
  const missing = "لا يوجد إعداد بهذا الاسم";
  await search.fill(missing);
  const none = page.getByText(
    messages.ui.search.none.replace("{query}", missing),
  );
  await expect(none).toBeVisible();
  await none
    .locator("..")
    .getByRole("button", { name: messages.ui.search.clear })
    .click();
  await expect(tabs).toBeVisible();
});

test("a count saved on the screen is what the next request reads, and reset to default puts it back", async ({
  page,
}, testInfo) => {
  const { group, label, from } = countFor(testInfo);
  // The group chosen on the screen, as an admin does: the address keeps it through the save, so
  // the reload opens it again (lead review B).
  await open(page);
  await page
    .getByRole("tablist", { name: text.groupsLabel })
    .getByRole("tab", { name: text.groups[group] })
    .click();
  const setting = row(page, label);
  await expect(setting.locator("output")).toContainText(String(from));

  await setting.getByRole("button", { name: text.stepper.increase }).click();
  await setting.getByRole("button", { name: text.save }).click();
  await expect(
    page.getByText(text.toast.saved.replace("{label}", label)),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]group=${group}\\b`));

  await page.reload();
  await expect(setting.locator("output")).toContainText(String(from + 1));
  await setting.getByRole("button", { name: text.reset }).click();
  await expect(
    page.getByText(text.toast.reset.replace("{label}", label)),
  ).toBeVisible();
  await page.reload();
  await expect(setting.locator("output")).toContainText(String(from));
  await expect(setting.getByRole("button", { name: text.reset })).toHaveCount(
    0,
  );
});

test("the sample rate's slider moves with the arrow keys the way the page reads", async ({
  page,
}) => {
  const label = text.fields.review.sampleRate.label;
  await open(page, "review");
  const setting = row(page, label);
  const slider = setting.getByRole("slider", { name: label });
  await expect(slider).toHaveAttribute("aria-valuenow", "20");
  await slider.focus();
  // Right to left, the track runs from the right: the left arrow raises the rate.
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", "21");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "19");
  await expect(slider).toHaveAttribute("aria-valuetext", /19/);
  // Never saved: discarding brings back the stored rate.
  await setting.getByRole("button", { name: messages.ui.discard }).click();
  await expect(slider).toHaveAttribute("aria-valuenow", "20");
});

test("the Hijri date joins Today's date while its setting is on", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "one switch, changed by one project",
  );
  const label = text.fields.locale.hijri.label;
  // The Umm al-Qura year ends in its era's abbreviation.
  const hijri = /\d{4} هـ/;
  await open(page, "locale");
  await row(page, label).getByRole("switch").click();
  await row(page, label).getByRole("button", { name: text.save }).click();
  await expect(
    page.getByText(text.toast.saved.replace("{label}", label)),
  ).toBeVisible();

  await page.goto("/today");
  const header = page.locator("main header");
  await expect(header).toContainText(hijri);
  await expect(header.getByRole("heading", { level: 1 })).toHaveText(
    today.title,
  );

  await open(page, "locale");
  await row(page, label).getByRole("button", { name: text.reset }).click();
  await expect(
    page.getByText(text.toast.reset.replace("{label}", label)),
  ).toBeVisible();
  await page.goto("/today");
  await expect(page.locator("main header")).not.toContainText(hijri);
});

test(
  "a security setting asks for the password again once it was last typed too long ago",
  DATABASE,
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "one session, made stale by one project",
    );
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { pool } = createDb(url);
    try {
      // The demo admin typed the password at sign-in; make that an hour ago.
      await pool.query(
        `update sessions set password_entered_at = now() - interval '1 hour'
         where user_id = (select id from users where email = $1)`,
        [demoAccounts.admin.email],
      );
      const label = text.fields.auth.reauthMinutes.label;
      await open(page, "security");
      const setting = row(page, label);
      // Typed in Arabic-Indic digits, read as Latin ones: the field's hint shows the count.
      await setting.getByRole("textbox", { name: label }).fill("٢٠");
      await expect(setting).toContainText("20");
      await setting.getByRole("button", { name: text.save }).click();

      const password = setting.getByLabel(reauth.password, {
        exact: true,
      });
      await expect(password).toBeFocused();
      await password.fill("not-the-password");
      await setting.getByRole("button", { name: reauth.submit }).click();
      await expect(setting.getByText(reauth.wrong)).toBeVisible();
      await password.fill(demo.adminPassword);
      await setting.getByRole("button", { name: reauth.submit }).click();
      await expect(
        page.getByText(text.toast.saved.replace("{label}", label)),
      ).toBeVisible();

      await page.reload();
      await expect(setting.getByRole("textbox", { name: label })).toHaveValue(
        "20",
      );
      // Typed a moment ago, so putting it back asks for nothing.
      await setting.getByRole("button", { name: text.reset }).click();
      await expect(
        page.getByText(text.toast.reset.replace("{label}", label)),
      ).toBeVisible();
      await expect(password).toHaveCount(0);
    } finally {
      await pool.end();
    }
  },
);

test("the settings page and its controls have no serious accessibility issue", async ({
  page,
}) => {
  await open(page, "security");
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control in each group has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
    await page.evaluate(() =>
      document.querySelector("nextjs-portal")?.remove(),
    );
    const search = page.getByRole("searchbox", { name: text.search.label });
    expect(await smallTargets(search.locator("xpath=../.."))).toEqual([]);
    for (const group of Object.values(text.groups)) {
      const tab = page.getByRole("tab", { name: group });
      await tab.click();
      // A chosen tab is scrolled clear of the arrows over the list's faded edges, once the list
      // has noticed the scroll, a frame later; one half under an arrow is scrolled content.
      await expect
        .poll(() => smallTargets(tab.locator("xpath=..")), { message: group })
        .toEqual([]);
      expect(await smallTargets(page.getByRole("tabpanel")), group).toEqual([]);
    }
  });
});

test("the vice-dean keeps the catalogs: a training method added is there after a reload, and taken out again (Step 18)", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "one catalog, changed by one project",
  );
  const page = await signedIn(browser, {
    identifier: demoAccounts.viceDean.employeeNumber,
    password: demo.password,
  });
  await open(page, "catalogs");
  // Only the groups whose settings the vice-dean's keys edit. A tab writes its label twice, once
  // under the mask that colors the chosen one, so its name is what counts.
  const tabs = page
    .getByRole("tablist", { name: text.groupsLabel })
    .getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.first()).toHaveAccessibleName(text.groups.calendar);
  await expect(tabs.last()).toHaveAccessibleName(text.groups.catalogs);
  const methods = row(page, text.fields.catalogs.trainingMethods.label);
  const list = methods.getByRole("list", {
    name: text.fields.catalogs.trainingMethods.label,
  });
  await expect(list).toContainText("دراسة الحالة");
  await methods
    .getByRole("textbox", { name: text.list.word.placeholder })
    .fill("  التعلم   باللعب ");
  await methods.getByRole("button", { name: text.list.add }).click();
  await expect(list).toContainText("التعلم باللعب");
  await methods.getByRole("button", { name: text.save }).click();
  const label = text.fields.catalogs.trainingMethods.label;
  await expect(
    page.getByText(text.toast.saved.replace("{label}", label)),
  ).toBeVisible();

  await page.reload();
  await expect(list).toContainText("التعلم باللعب");
  await methods
    .getByRole("button", {
      name: text.list.remove.replace("{item}", "التعلم باللعب"),
    })
    .click();
  await methods.getByRole("button", { name: text.save }).click();
  await expect(
    page.getByText(text.toast.saved.replace("{label}", label)),
  ).toBeVisible();
  await page.reload();
  await expect(list).not.toContainText("التعلم باللعب");
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("without settings.manage", () => {
  test.use({ storageState: STORAGE.trainer });

  test("the page answers with the refusal, and the shell offers no settings", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: nav.settings })).toHaveCount(0);
  });
});
