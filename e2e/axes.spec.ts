import { createTranslator } from "next-intl";
import { portfolioAxes } from "../db/seed/base.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { createDb } from "../src/platform/db/client.ts";
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { axes: text, pages } = messages;
const t = createTranslator({ locale: "ar", messages, namespace: "axes" });
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

test.describe("the admin", () => {
  test.use({ storageState: STORAGE.admin });

  test(
    "sees the axes in their groups and corrects an axis's description on the screen (Step 14)",
    DATABASE,
    async ({ page, hasTouch }, { project }) => {
      const url = process.env.DATABASE_URL;
      if (!url)
        throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
      const { pool } = createDb(url);
      // The desktop and the phone run side by side, so each corrects an axis of its own.
      const code = project.name === "desktop" ? "7" : "8";
      const {
        rows: [axis],
      } = await pool.query(
        "select id, title, description from axes where code = $1",
        [code],
      );
      const description = `وصف ${project.name} ${Date.now().toString(36)}`;
      try {
        await page.goto("/axes");
        await expect(
          page.getByRole("heading", { level: 1, name: text.title }),
        ).toBeVisible();
        for (const group of portfolioAxes) {
          await expect(
            page.getByRole("region", { name: group.title }),
          ).toBeVisible();
        }
        expect(await seriousViolations(page)).toEqual([]);
        if (hasTouch) {
          expect(await smallTargets(page.locator("main"))).toEqual([]);
        }
        // The check wrote the page's letters over, so it is drawn again.
        await page.reload();

        await page
          .getByRole("button", { name: t("edit", { title: axis.title }) })
          .click();
        const sheet = page.getByRole("dialog");
        await sheet
          .getByRole("textbox", { name: text.fields.description })
          .fill(description);
        await sheet.getByRole("button", { name: text.save }).click();
        await expect(page.getByText(t("saved", { code }))).toBeVisible();
        await expect(
          page.getByRole("listitem").filter({ hasText: axis.title }),
        ).toContainText(description);
      } finally {
        await pool.query("update axes set description = $2 where id = $1", [
          axis.id,
          axis.description,
        ]);
        await pool.end();
      }
    },
  );
});

test.describe("without the axes' key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the axes page", async ({ page }) => {
    await page.goto("/axes");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
  });
});
