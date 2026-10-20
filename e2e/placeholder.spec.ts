import { expect, test } from "@playwright/test";
import messages from "../messages/ar.json" with { type: "json" };

test("the placeholder page renders right-to-left in Arabic", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("main")).toBeVisible();
});

test("the notifications region takes its label from the message catalog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: messages.toast.region }),
  ).toBeAttached();
});

test("the page carries the messages its client components read, not the whole catalog", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain(messages.ui.close);
  expect(html).not.toContain(messages.design.intro);
});
