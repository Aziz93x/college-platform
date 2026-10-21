import type { Browser, Locator, Page } from "@playwright/test";
import messages from "../../messages/ar.json" with { type: "json" };
import { enterCode, signIn } from "./auth.ts";
import { expect } from "./test.ts";

const { reauth } = messages;

// Waits until React owns the page's table or form: a press before that is lost.
export async function owned(page: Page) {
  await page.waitForFunction(() => {
    const element = document.querySelector("main table, main form");
    return (
      element !== null &&
      Object.keys(element).some((key) => key.startsWith("__reactFiber$"))
    );
  });
}

export async function open(page: Page, path: string) {
  await page.goto(path);
  await owned(page);
}

// A page signed in on its own session, so its password and its changes leave the shared demo
// sessions alone.
export async function signedIn(
  browser: Browser,
  person: { identifier: string; password: string },
  key?: Buffer,
) {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.goto("/");
  await signIn(page, person);
  if (key) await enterCode(page, key);
  await expect(page).toHaveURL("/today");
  return page;
}

// A change to someone's account or access asks for the password again once it was typed too long
// ago, which another test may have made it on purpose: type it when asked, then wait for what the
// change shows.
export async function confirmIfAsked(
  page: Page,
  done: Locator,
  password: string,
) {
  const field = page.getByLabel(reauth.password, { exact: true });
  await expect(done.or(field).first()).toBeVisible();
  if (await field.isVisible()) {
    await field.fill(password);
    await page.getByRole("button", { name: reauth.submit }).click();
  }
  await expect(done).toBeVisible();
}
