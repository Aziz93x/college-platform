import { createHmac } from "node:crypto";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import messages from "../../messages/ar.json" with { type: "json" };

const { signIn: signInText, twoFactor } = messages.auth;

// Where e2e/auth.setup.ts keeps each demo role's signed-in browser state (/.local is gitignored).
export const STORAGE = {
  trainer: join(import.meta.dirname, "../../.local/e2e/trainer.json"),
  admin: join(import.meta.dirname, "../../.local/e2e/admin.json"),
} as const;

// An authenticator app's code (RFC 6238: HMAC-SHA1, 30 seconds, six digits), computed here so the
// tests check Better Auth against the standard rather than against itself.
export function totp(key: Buffer, now = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(
    6,
    "0",
  );
}

// The key an authenticator app is given (RFC 4648 base32, spaces ignored), as bytes.
export function base32Bytes(text: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of text.replace(/[\s=]/g, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
}

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
