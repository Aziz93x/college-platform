import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import messages from "../../messages/ar.json" with { type: "json" };
import { totp } from "../../tests/support/totp.ts";

const { signIn: signInText, twoFactor } = messages.auth;

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
