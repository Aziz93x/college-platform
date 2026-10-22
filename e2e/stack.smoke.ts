import { randomBytes } from "node:crypto";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { demo, signIn, signOut } from "./support/auth.ts";
import { expect, test } from "./support/test.ts";

const { changePassword } = messages.auth;

// Only the stack's smoke runs this file (e2e/stack.config.ts); pnpm test:e2e never does. The full
// suite replaces a temporary password on an account it makes in the database. The stack publishes no
// database port, so here the demo's invited trainer does it, once per fresh demo stack, and meets the
// announcement the demo left unread for them.
test("the invited demo trainer replaces the temporary password, signs out and signs in with the new one", async ({
  page,
}) => {
  const person = demoAccounts.invitedTrainer;
  const fresh = randomBytes(12).toString("base64url");
  await page.goto("/");
  await signIn(page, { identifier: person.email, password: demo.password });
  await expect(page).toHaveURL("/change-password");

  await page.getByLabel(changePassword.current).fill(demo.password);
  await page.getByLabel(changePassword.new, { exact: true }).fill(fresh);
  await page.getByLabel(changePassword.confirm).fill(fresh);
  await page.getByRole("button", { name: changePassword.submit }).click();
  await expect(page).toHaveURL("/today");
  // The dean's announcement, which the demo left them to read, opens over Today; closed, it is read
  // and does not come back (ADR-0017).
  const announced = page.getByRole("dialog");
  await expect(announced).toBeVisible();
  await announced
    .getByRole("button", { name: messages.announcements.dialog.close })
    .click();
  await expect(announced).toBeHidden();

  await signOut(page, person);
  await signIn(page, { identifier: person.employeeNumber, password: fresh });
  await expect(page).toHaveURL("/today");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
