import { expect, type Page } from "@playwright/test";

// The identity elements that /design shows from /brand/, which pnpm identity:sync fetches.
export const identityImages = (page: Page) =>
  page.locator('section[aria-labelledby="identity"] img');

// Fails when /brand/ is not served, for example by a standalone server without public/ next to
// it, or when the identity font has not loaded, so a broken render never passes as the reference.
export async function expectIdentityLoaded(page: Page) {
  const images = identityImages(page);
  await expect(images).toHaveCount(3);
  for (const image of await images.all()) {
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) =>
          element.complete ? element.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
  }
  // next/font names the face in --font-identity, then its fallback. Body text uses Regular and
  // headings Medium, so both faces load.
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    const unquote = (name: string) => name.trim().replace(/^["']|["']$/g, "");
    const family = unquote(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-identity")
        .split(",")[0],
    );
    return [...document.fonts]
      .filter((face) => unquote(face.family) === family)
      .map((face) => `${face.weight} ${face.status}`)
      .sort();
  });
  expect(faces).toEqual(["400 loaded", "500 loaded"]);
}
