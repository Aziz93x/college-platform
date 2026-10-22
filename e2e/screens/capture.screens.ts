import { test } from "@playwright/test";
import { STORAGE } from "../support/auth.ts";
import { screenPath, screensOptions } from "./options";
import { settled } from "./settled";

const { routes, roles, out } = screensOptions(process.env);

// Each project in screens.config.ts is one width, named after it. A role other than anonymous
// starts from the state e2e/auth.setup.ts saved for it.
for (const role of roles) {
  test.describe(role, () => {
    if (role === "trainer" || role === "admin") {
      test.use({ storageState: STORAGE[role] });
    }
    for (const route of routes) {
      test(`${role} ${route}`, async ({ page }, { project }) => {
        await page.goto(route);
        await settled(page);
        // At CSS scale every width shares one scale, and a 44 px target measures 44 px in the
        // image (UX review 1).
        await page.screenshot({
          path: screenPath(out, role, route, project.name),
          fullPage: true,
          animations: "disabled",
          scale: "css",
        });
      });
    }
  });
}
