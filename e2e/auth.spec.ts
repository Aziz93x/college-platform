import { randomInt } from "node:crypto";
import type { Page } from "@playwright/test";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoCollege } from "../db/seed/demo/college.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { demoSettings } from "../db/seed/demo/settings.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { createDb } from "../src/platform/db/client.ts";
import { base32Bytes, totp } from "../tests/support/totp.ts";
import { expect, type TestAccount, test } from "./support/accounts.ts";
import { demo, enterCode, signIn, signOut } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";

const {
  signIn: signInText,
  twoFactor,
  twoFactorSetup,
  changePassword,
} = messages.auth;
const { profile, reauth } = messages;
const DAY_MS = 86_400_000;
// Tests that make their own accounts in the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };
const demoKey = Buffer.from(demo.totpSecret);
const [, electrical] = demoDepartments.map(({ name }) => name);

const signInAs = async (page: Page, person: TestAccount, password?: string) => {
  await page.goto("/");
  await signIn(page, {
    identifier: person.employeeNumber,
    password: password ?? person.password,
  });
};

// One wrong attempt on the open login page, and the answer it gets. The form's alert; Next.js's
// route announcer is an alert too. Each attempt ends when the form empties its password field; the
// next one starts after that.
const wrongAttempt = async (page: Page, identifier: string, title: string) => {
  await signIn(page, { identifier, password: "a-wrong-password" });
  await expect(
    page.getByLabel(signInText.password, { exact: true }),
  ).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(title);
};

// The demo college's own names and banner, which seed:demo stores as settings.
test("the login page names the platform and the college under the pilot banner, and signs in by employee number", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: demoSettings["pilot.bannerText"] }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    demoSettings["platform.name"],
  );
  await expect(page.getByText(demoCollege.name)).toBeVisible();
  await expect(page).toHaveTitle(
    `${signInText.title} · ${demoSettings["platform.name"]}`,
  );

  await signIn(page, {
    identifier: demoAccounts.trainer.employeeNumber,
    password: demo.password,
  });
  await expect(page).toHaveURL("/today");
});

test("typed text stays clear of each field's icons, whichever way it runs", async ({
  page,
}) => {
  await page.goto("/");
  const identifier = page.getByLabel(signInText.identifier);
  const password = page.getByLabel(signInText.password, { exact: true });
  // A long email and a long passphrase, both left to right on a right-to-left page.
  await identifier.fill("abdulrahman.alqahtani.training@oasis.example");
  await password.fill("a long passphrase that fills the whole field");
  await page.getByRole("button", { name: signInText.showPassword }).click();

  for (const field of [identifier, password]) {
    // Where the text shows: the field without its padding and border.
    const text = await field.evaluate((input) => {
      const box = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      return {
        left:
          box.left +
          Number.parseFloat(style.borderLeftWidth) +
          Number.parseFloat(style.paddingLeft),
        right:
          box.right -
          Number.parseFloat(style.borderRightWidth) -
          Number.parseFloat(style.paddingRight),
      };
    });
    // The icons, and the whole of a button such as "show password", not just its icon.
    const icons = await field
      .locator("xpath=..")
      .locator("svg, button")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right };
        }),
      );
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.right <= text.left || icon.left >= text.right).toBe(true);
    }
  }
});

test(
  "signs out from the account menu; the shell then sends back to the login page",
  DATABASE,
  async ({ page, account }) => {
    const person = await account();
    await page.goto("/today");
    await expect(page).toHaveURL("/");

    await page.goto("/");
    await signIn(page, { identifier: person.email, password: person.password });
    await expect(page).toHaveURL("/today");
    await signOut(page, person);

    await page.goto("/today");
    await expect(page).toHaveURL("/");
  },
);

// What was typed is locked whether or not an account has it, so this half needs no account and runs
// on the stack too, where the limits key on the address Caddy forwards.
test("an employee number no account has gets the wrong-password answer, and the lock after five attempts", async ({
  page,
}) => {
  // Each run types a new number, so its attempts never add up with an earlier run's.
  const unknown = `8${Date.now()}${randomInt(10)}`;
  await page.goto("/");
  for (let attempt = 1; attempt <= 4; attempt++) {
    await wrongAttempt(page, unknown, signInText.invalid.title);
  }
  await wrongAttempt(page, unknown, signInText.locked.title);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("15");
});

test(
  "five wrong passwords lock the account, and the right one then gets the lock too",
  DATABASE,
  async ({ page, account }) => {
    const person = await account();
    const alert = page.getByRole("main").getByRole("alert");
    await page.goto("/");

    for (let attempt = 1; attempt <= 4; attempt++) {
      await wrongAttempt(page, person.employeeNumber, signInText.invalid.title);
    }
    await wrongAttempt(page, person.employeeNumber, signInText.locked.title);
    await expect(alert).toContainText("15");

    // The right password does not open a locked account.
    await signIn(page, {
      identifier: person.employeeNumber,
      password: person.password,
    });
    await expect(alert).toContainText(signInText.locked.title);
    await expect(page).toHaveURL("/");
  },
);

// On the demo trainer, so that it runs on the stack too, where the cookie comes over Caddy's TLS.
test("remember this device keeps the person signed in after the browser closes; otherwise the session ends with it", async ({
  browser,
  baseURL,
}) => {
  for (const remember of [true, false]) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await signIn(page, {
      identifier: demoAccounts.trainer.email,
      password: demo.password,
      remember,
    });
    await expect(page).toHaveURL("/today");

    const cookies = await context.cookies();
    const session = cookies.find(({ name }) => name.endsWith("session_token"));
    // Host-only (no Domain attribute), Secure, HttpOnly and SameSite=Lax.
    expect(session).toMatchObject({
      name: "__Secure-college.session_token",
      domain: "localhost",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
    if (remember) {
      expect((session?.expires ?? 0) * 1000).toBeGreaterThan(
        Date.now() + 20 * DAY_MS,
      );
    } else {
      expect(session?.expires).toBe(-1);
    }
    await context.close();

    // A browser keeps only the cookies that have an expiry when it closes.
    const reopened = await browser.newContext({
      baseURL,
      storageState: {
        cookies: cookies.filter(({ expires }) => expires !== -1),
        origins: [],
      },
    });
    const again = await reopened.newPage();
    await again.goto("/today");
    await expect(again).toHaveURL(remember ? "/today" : "/");
    await reopened.close();
  }
});

test("an admin signs in with the code from the authenticator app; a wrong code is refused", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, {
    identifier: demoAccounts.admin.employeeNumber,
    password: demo.adminPassword,
  });
  await expect(page).toHaveURL("/two-factor");

  // A code from none of the time steps the server accepts (the current one and one either side).
  const now = Date.now();
  const valid = [-30_000, 0, 30_000].map((offset) =>
    totp(demoKey, now + offset),
  );
  const wrong = ["000000", "111111", "222222", "333333"].find(
    (code) => !valid.includes(code),
  );
  await page.getByLabel(twoFactor.code).fill(wrong ?? "");
  await page.getByRole("button", { name: twoFactor.submit }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    twoFactor.invalid.title,
  );

  await enterCode(page, demoKey);
  await expect(page).toHaveURL("/today");
});

// Whether the college requires two-factor of the keys that need it (ADR-0014), stored as the
// settings page stores it. Off is the default, which seed:demo keeps.
async function requireTwoFactor(on: boolean) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { pool } = createDb(url);
  try {
    await (on
      ? pool.query(
          `insert into settings (college_id, key, value)
           select id, 'auth.requireTwoFactor', 'true' from colleges
           on conflict (college_id, key) do update set value = excluded.value`,
        )
      : pool.query("delete from settings where key = 'auth.requireTwoFactor'"));
  } finally {
    await pool.end();
  }
}

// Sets up two-factor on the setup page, and returns the key the app was given and the backup codes.
async function setUpTwoFactor(page: Page, password: string) {
  await page.getByLabel(twoFactorSetup.password).fill(password);
  await page.getByRole("button", { name: twoFactorSetup.start }).click();
  await expect(
    page.getByRole("img", { name: twoFactorSetup.qr }),
  ).toBeVisible();
  const key = (await page.locator("code").textContent()) ?? "";
  const backupCodes = await page.getByRole("listitem").allTextContents();
  await page.getByLabel(twoFactorSetup.code).fill(totp(base32Bytes(key)));
  await page.getByRole("button", { name: twoFactorSetup.confirm }).click();
  return { key, backupCodes };
}

// Two-factor is each person's choice while the college does not require it (ADR-0014): a trainer,
// whom the setting never decides for, turns it on and off.
test(
  "anyone turns two-factor on from their profile, and off again with the password, which then signs them in alone",
  DATABASE,
  async ({ page, account }) => {
    const person = await account({ trainerIn: electrical });
    await signInAs(page, person);
    await expect(page).toHaveURL("/today");

    await page.goto("/profile");
    await expect(page.getByText(profile.twoFactorOff)).toBeVisible();
    await page.getByRole("link", { name: profile.twoFactorTurnOn }).click();
    await expect(page).toHaveURL("/two-factor/setup");
    await expect(
      page.getByText(twoFactorSetup.descriptionOptional),
    ).toBeVisible();
    await setUpTwoFactor(page, person.password);
    await expect(page).toHaveURL("/profile");
    await expect(page.getByText(profile.twoFactorOn)).toBeVisible();

    await page
      .getByRole("button", { name: profile.twoFactorTurnOff.open })
      .click();
    const sheet = page.getByRole("dialog");
    const turnOff = async (password: string) => {
      await sheet.getByLabel(reauth.password).fill(password);
      await sheet
        .getByRole("button", { name: profile.twoFactorTurnOff.confirm })
        .click();
    };
    await turnOff("a-wrong-password");
    await expect(sheet.getByText(reauth.wrong)).toBeVisible();
    await turnOff(person.password);
    await expect(page.getByText(profile.twoFactorTurnOff.done)).toBeVisible();
    await expect(page.getByText(profile.twoFactorOff)).toBeVisible();

    await signOut(page, person);
    await signIn(page, {
      identifier: person.employeeNumber,
      password: person.password,
    });
    await expect(page).toHaveURL("/today");
  },
);

test(
  "while the college requires it, an admin without two-factor sets it up before anything else, cannot turn it off, and can sign in with a backup code",
  DATABASE,
  async ({ page, account }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "one college, whose setting one project turns on at a time",
    );
    const admin = await account({ admin: true });
    await requireTwoFactor(true);
    try {
      await signInAs(page, admin);
      await expect(page).toHaveURL("/two-factor/setup");
      await page.goto("/today");
      await expect(page).toHaveURL("/two-factor/setup");
      await expect(page.getByText(twoFactorSetup.description)).toBeVisible();
      await expect(
        page.getByRole("link", { name: twoFactorSetup.back }),
      ).toHaveCount(0);

      const { backupCodes } = await setUpTwoFactor(page, admin.password);
      expect(backupCodes).toHaveLength(10);
      await expect(page).toHaveURL("/today");
      await page.goto("/profile");
      await expect(page.getByText(profile.twoFactorRequired)).toBeVisible();
      await expect(
        page.getByRole("button", { name: profile.twoFactorTurnOff.open }),
      ).toHaveCount(0);
      await signOut(page, admin);

      await signIn(page, {
        identifier: admin.employeeNumber,
        password: admin.password,
      });
      await expect(page).toHaveURL("/two-factor");
      await page.getByRole("button", { name: twoFactor.useBackup }).click();
      await page.getByLabel(twoFactor.backupCode).fill(backupCodes[0]);
      await page.getByRole("button", { name: twoFactor.submit }).click();
      await expect(page).toHaveURL("/today");
    } finally {
      await requireTwoFactor(false);
    }
  },
);

test(
  "a temporary password must be replaced before anything else",
  DATABASE,
  async ({ page, account }) => {
    const person = await account({ temporary: true });
    const fresh = "a-new-and-longer-password";
    await signInAs(page, person);
    await expect(page).toHaveURL("/change-password");
    await page.goto("/today");
    await expect(page).toHaveURL("/change-password");
    await expect(
      page.getByRole("link", { name: changePassword.cancel }),
    ).toHaveCount(0);

    const fill = async (confirm: string) => {
      await page.getByLabel(changePassword.current).fill(person.password);
      await page.getByLabel(changePassword.new, { exact: true }).fill(fresh);
      await page.getByLabel(changePassword.confirm).fill(confirm);
      await page.getByRole("button", { name: changePassword.submit }).click();
    };
    await fill("a-different-password");
    await expect(page.getByText(changePassword.mismatch)).toBeVisible();
    await fill(fresh);
    await expect(page).toHaveURL("/today");

    await signOut(page, person);
    await signIn(page, { identifier: person.employeeNumber, password: fresh });
    await expect(page).toHaveURL("/today");
  },
);

test.describe("axe", () => {
  test("finds no serious issue on the login page, with its errors showing", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: signInText.submit }).click();
    await expect(page.getByText(signInText.passwordRequired)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test(
    "finds no serious issue on the code page and the password page",
    DATABASE,
    async ({ page, account }) => {
      await page.goto("/");
      await signIn(page, {
        identifier: demoAccounts.admin.email,
        password: demo.adminPassword,
      });
      await expect(page).toHaveURL("/two-factor");
      expect(await seriousViolations(page)).toEqual([]);

      const person = await account({ temporary: true });
      await page.context().clearCookies();
      await signInAs(page, person);
      await expect(page).toHaveURL("/change-password");
      expect(await seriousViolations(page)).toEqual([]);
    },
  );
});
