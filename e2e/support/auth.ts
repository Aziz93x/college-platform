import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { demoSecrets } from "../../db/seed/demo/accounts.ts";
import messages from "../../messages/ar.json" with { type: "json" };
import { totp } from "../../tests/support/totp.ts";

const { signIn: signInText, twoFactor, account: accountMenu } = messages.auth;

// The demo accounts' password and the admin's authenticator secret on the server under test: the
// published ones on a laptop and in CI's first job, the stack's own in demo mode (e2e/stack.config.ts
// reads them from docker/.env).
export const demo = demoSecrets(process.env);

// Where e2e/auth.setup.ts keeps each demo role's signed-in browser state (/.local is gitignored).
export const STORAGE = {
  trainer: join(import.meta.dirname, "../../.local/e2e/trainer.json"),
  admin: join(import.meta.dirname, "../../.local/e2e/admin.json"),
} as const;

// Signs in on the login page, which must already be open.
export async function signIn(
  page: Page,
  {
    identifier,
    password,
    remember = false,
  }: { identifier: string; password: string; remember?: boolean },
) {
  await page.getByLabel(signInText.identifier).fill(identifier);
  await page.getByLabel(signInText.password, { exact: true }).fill(password);
  if (remember) {
    await page.getByRole("checkbox", { name: signInText.remember }).click();
  }
  await page.getByRole("button", { name: signInText.submit }).click();
}

// The second step: the code the app shows now.
export async function enterCode(page: Page, key: Buffer) {
  await expect(page).toHaveURL("/two-factor");
  await page.getByLabel(twoFactor.code).fill(totp(key));
  await page.getByRole("button", { name: twoFactor.submit }).click();
}

// Signs out from the account menu, which carries the person's name, and lands on the login page.
// A press before React has hydrated the menu's button only focuses it, so the press waits for that.
export async function signOut(page: Page, person: { name: string }) {
  const trigger = page.getByRole("button", {
    name: accountMenu.open.replace("{name}", person.name),
  });
  await expect
    .poll(() =>
      trigger.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
  await trigger.click();
  await page.getByRole("menuitem", { name: accountMenu.signOut }).click();
  await expect(page).toHaveURL("/");
}
