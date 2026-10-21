import { demoAccounts } from "../db/seed/demo/accounts.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { demo, signIn } from "./support/auth.ts";
import { expect, test } from "./support/test.ts";

const { signIn: signInText } = messages.auth;
const { today } = messages;

// The engines the platform opens in beyond the current Chromium: the safari project runs this file
// in WebKit, and each project runs it as an engine from before Intl.Locale#getTextInfo() (Safari 16,
// Firefox before 153). Every page's scripts once called that method unguarded, so on those browsers
// it threw and React never started: no control on any page answered.

test("the sign-in page comes alive in an engine without Intl.Locale#getTextInfo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Intl.Locale.prototype, "getTextInfo");
    Reflect.deleteProperty(Intl.Locale.prototype, "textInfo");
  });
  await page.goto("/");
  const show = page.getByRole("button", { name: signInText.showPassword });
  await expect
    .poll(() =>
      show.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
  await show.click();
  await expect(
    page.getByLabel(signInText.password, { exact: true }),
  ).toHaveAttribute("type", "text");
});

test("a trainer signs in and reaches Today", async ({ page, browserName }) => {
  test.skip(
    browserName !== "webkit",
    "e2e/auth.spec.ts signs in throughout on Chromium",
  );
  await page.goto("/");
  await signIn(page, {
    identifier: demoAccounts.trainer.employeeNumber,
    password: demo.password,
  });
  await expect(page).toHaveURL("/today");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.title);
});
