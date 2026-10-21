import { expect, test } from "@playwright/test";
import { expectIdentityLoaded, identityImages } from "./identity-assets";
import { settled } from "./screens/settled";
import { STORAGE } from "./support/auth.ts";

// The catalog is open to whoever holds design.view: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

// Baselines come from CI's pinned Chromium, never from a laptop: a run there writes a missing
// baseline and fails, and the baselines job in .github/workflows/ci.yml commits it to the pull
// request. To update one, delete it and push. Only CI runs @visual tests, in the desktop project.
for (const width of [390, 768, 1440]) {
  test(
    `/design matches its baseline at ${width} px`,
    { tag: "@visual" },
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/design");
      // The catalog, not its loading skeleton, with the brand elements and the font loaded.
      await settled(page);
      await expectIdentityLoaded(page);
      await expect(page).toHaveScreenshot(`design-${width}.png`, {
        fullPage: true,
        animations: "disabled",
        // The brand elements stay out of git (ADR-0004), so the committed baseline masks them;
        // expectIdentityLoaded has proved they loaded.
        mask: [identityImages(page)],
      });
    },
  );
}
