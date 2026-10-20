import { test } from "@playwright/test";
import { screenPath, screensOptions } from "./options";
import { settled } from "./settled";

const { routes, roles, out } = screensOptions(process.env);

// Each project in screens.config.ts is one width, named after it.
for (const role of roles) {
  for (const route of routes) {
    test(`${role} ${route}`, async ({ page }, { project }) => {
      await page.goto(route);
      await settled(page);
      await page.screenshot({
        path: screenPath(out, role, route, project.name),
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
