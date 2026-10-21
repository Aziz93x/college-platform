import { randomBytes } from "node:crypto";
import messages from "../messages/ar.json" with { type: "json" };
import { base32Bytes, totp } from "../tests/support/totp.ts";
import { signIn } from "./support/auth.ts";
import { expect, test } from "./support/test.ts";

const { changePassword, twoFactorSetup } = messages.auth;
const { profile } = messages;

// Only e2e/first-run.config.ts runs this file, on a production-like stack where pnpm local:run
// admin:create has just made the first admin. The full suite takes the same steps on accounts it
// makes in the database (auth.spec.ts); here they run on the production images, behind Caddy.
// Two-factor is the college's choice and off at first (ADR-0014): the admin sets it up from the
// profile.
test("the first admin replaces the temporary password, reaches Today, and sets up two-factor from the profile", async ({
  page,
}) => {
  const identifier = process.env.FIRST_ADMIN_EMPLOYEE_NUMBER;
  const temporary = process.env.FIRST_ADMIN_PASSWORD;
  if (!identifier || !temporary) {
    throw new Error(
      "e2e: set FIRST_ADMIN_EMPLOYEE_NUMBER and FIRST_ADMIN_PASSWORD from pnpm local:run admin:create",
    );
  }
  const fresh = randomBytes(12).toString("base64url");
  await page.goto("/");
  await signIn(page, { identifier, password: temporary });
  await expect(page).toHaveURL("/change-password");

  await page.getByLabel(changePassword.current).fill(temporary);
  await page.getByLabel(changePassword.new, { exact: true }).fill(fresh);
  await page.getByLabel(changePassword.confirm).fill(fresh);
  await page.getByRole("button", { name: changePassword.submit }).click();
  await expect(page).toHaveURL("/today");

  await page.goto("/profile");
  await page.getByRole("link", { name: profile.twoFactorTurnOn }).click();
  await expect(page).toHaveURL("/two-factor/setup");
  await page.getByLabel(twoFactorSetup.password).fill(fresh);
  await page.getByRole("button", { name: twoFactorSetup.start }).click();
  const key = (await page.locator("code").textContent()) ?? "";
  await page.getByLabel(twoFactorSetup.code).fill(totp(base32Bytes(key)));
  await page.getByRole("button", { name: twoFactorSetup.confirm }).click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByText(profile.twoFactorOn)).toBeVisible();
});
