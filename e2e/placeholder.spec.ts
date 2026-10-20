import { expect, test } from "@playwright/test";

test("the placeholder page renders right-to-left in Arabic", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("main")).toBeVisible();
});
