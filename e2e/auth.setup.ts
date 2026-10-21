import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demo, enterCode, STORAGE, signIn } from "./support/auth.ts";
import { expect, test as setup } from "./support/test.ts";

// Signs in the demo roles once per run; the specs that need a role start from its saved state.
// Specs that sign out sign in on their own, so these sessions stay valid for the whole run.

setup("sign in the demo trainer", async ({ page }) => {
  await page.goto("/");
  await signIn(page, {
    identifier: demoAccounts.trainer.employeeNumber,
    password: demo.password,
  });
  await expect(page).toHaveURL("/today");
  await page.context().storageState({ path: STORAGE.trainer });
});

setup(
  "sign in the demo admin, with the authenticator code",
  async ({ page }) => {
    await page.goto("/");
    await signIn(page, {
      identifier: demoAccounts.admin.email,
      password: demo.password,
    });
    await enterCode(page, Buffer.from(demo.totpSecret));
    await expect(page).toHaveURL("/today");
    await page.context().storageState({ path: STORAGE.admin });
  },
);
