import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { demoSignInHelp } from "../db/seed/demo/control-panel.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { findCollegeId } from "../src/modules/org/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { confirmIfAsked, signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { console: board, system, texts, nav, pages } = messages;
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
});
const [, electrical] = demoDepartments.map(({ name }) => name);
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };

// The control panel is the demo admin's, who holds every key (e2e/auth.setup.ts, ADR-0029).
test.use({ storageState: STORAGE.admin });

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  return createDb(url);
}

// Waits until React owns a control: a press before that is lost.
async function hydrated(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
  return control;
}

// The words a message starts with, before the value it is given: for a message whose value the
// test does not know, such as the device a browser reads as.
const before = (message: string) =>
  new RegExp(
    `^${message.split("{")[0]?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  );

const card = (page: Page, title: string) =>
  page.getByRole("region", { name: title });

test("the console shows what needs the admin, the college at a glance, the latest changes, and a tile for each page of the administration", async ({
  page,
}) => {
  await page.goto("/console");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(board.title);
  await expect(
    page.getByRole("heading", { name: board.attention.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: board.glance.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: board.changes.title }),
  ).toBeVisible();
  const tiles = card(page, board.pages);
  for (const id of [
    "departments",
    "roles",
    "people",
    "settings",
    "texts",
    "audit",
    "system",
    "axes",
  ] as const) {
    await expect(
      tiles.getByRole("link", { name: new RegExp(`^${nav[id]}`) }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: board.changes.all }).click();
  await expect(page).toHaveURL("/audit");
});

test("the system page shows its checks, the night before's failed pass behind the one that did its work, and the sessions, which it can all end", async ({
  page,
}) => {
  await page.goto("/system");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    system.title,
  );
  const checks = card(page, system.checks.title);
  await expect(
    checks.getByText(before(system.checks.database.up)),
  ).toBeVisible();
  await expect(
    checks.getByText(system.checks.queue.up, { exact: true }),
  ).toBeVisible();
  await expect(
    checks.getByText(system.checks.worker.label, { exact: true }),
  ).toBeVisible();

  // The demo's failed nightly pass: its error shows, and a later pass did its work, so it is not
  // run again.
  const passes = card(page, system.passes.title);
  await expect(
    passes.getByText("Connection terminated unexpectedly"),
  ).toBeVisible();
  await expect(
    passes.getByRole("button", { name: before(system.passes.rerunLabel) }),
  ).toHaveCount(0);

  const sessions = card(page, system.sessions.title);
  const everyone = await hydrated(
    sessions.getByRole("button", { name: system.sessions.everyone.button }),
  );
  await everyone.click();
  const sheet = page.getByRole("dialog", {
    name: system.sessions.everyone.title,
  });
  await expect(sheet).toContainText(system.sessions.everyone.description);
  // Signing everyone out would end the other tests' sessions: the integration tests run it.
  await sheet.getByRole("button", { name: messages.ui.cancel }).click();
  await expect(sheet).toBeHidden();
});

test(
  "a failed pass of a term still open runs again from the system page, as a new pass the admin caused (ADR-0029)",
  DATABASE,
  async ({ page }) => {
    const { db, pool } = database();
    const collegeId = (await findCollegeId(db)) ?? "";
    const name = `فصل التوليد ${randomInt(100_000, 999_999)}`;
    const {
      rows: [term],
    } = await pool.query(
      "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2033-01-02', 18) returning id",
      [collegeId, name],
    );
    try {
      await pool.query(
        `insert into generation_runs (college_id, term_id, reason, status, error, finished_at)
         values ($1, $2, 'daily', 'failed', 'Connection terminated unexpectedly', now())`,
        [collegeId, term.id],
      );
      await page.goto("/system");
      const rerun = page.getByRole("button", {
        name: t("system.passes.rerunLabel", { term: name }),
      });
      await (await hydrated(rerun)).click();
      await expect(
        page.getByText(t("system.passes.rerunDone", { term: name })),
      ).toBeVisible();
      // The new pass waits for the worker, and the failed one is no longer the term's latest.
      await expect(rerun).toHaveCount(0);
      const { rows } = await pool.query(
        "select reason, status from generation_runs where term_id = $1 order by queued_at",
        [term.id],
      );
      expect(rows).toEqual([
        { reason: "daily", status: "failed" },
        { reason: "admin", status: "queued" },
      ]);
    } finally {
      await pool.query("delete from generation_runs where term_id = $1", [
        term.id,
      ]);
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    }
  },
);

test(
  "the admin ends someone's session, whose device is signed out at its next request, then asks them for a new password, which their next request asks for first (ADR-0029)",
  DATABASE,
  async ({ page, browser, account }) => {
    const person = await account({ trainerIn: electrical });
    const credentials = {
      identifier: person.employeeNumber,
      password: person.password,
    };
    const trainer = await signedIn(browser, credentials);

    await page.goto(`/people/${person.userId}`);
    const sessions = card(page, messages.people.sessions.title);
    await expect(sessions.getByRole("listitem")).toHaveCount(1);
    await (
      await hydrated(
        sessions.getByRole("button", {
          name: before(messages.people.sessions.revoke.label),
        }),
      )
    ).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: messages.people.sessions.revoke.confirm })
      .click();
    await confirmIfAsked(
      page,
      page.getByText(
        before(
          messages.people.sessions.revoke.done.replace("{name}", person.name),
        ),
      ),
      demo.adminPassword,
    );
    await expect(
      sessions.getByText(messages.people.sessions.empty),
    ).toBeVisible();
    await trainer.goto("/today");
    await expect(trainer).toHaveURL("/");

    const again = await signedIn(browser, credentials);
    await page
      .getByRole("button", {
        name: messages.people.sessions.requirePasswordChange.button,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: messages.people.sessions.requirePasswordChange.confirm,
      })
      .click();
    await confirmIfAsked(
      page,
      page.getByText(
        t("people.sessions.requirePasswordChange.done", { name: person.name }),
      ),
      demo.adminPassword,
    );
    await again.goto("/today");
    await expect(again).toHaveURL("/change-password");
  },
);

test(
  "the texts page lists the college's wording, finds any text by its words or key, words it the college's way and puts its default back",
  DATABASE,
  async ({ page, isMobile }) => {
    // The desktop and the phone run side by side on one database: the phone changes the text.
    test.skip(!isMobile, "the phone changes the text");
    // The page's own description, which no other test reads.
    const key = "texts.description";
    const { pool } = database();
    try {
      await page.goto("/texts");
      const changed = page.getByRole("region", { name: texts.changed.title });
      await expect(
        changed
          .getByRole("listitem")
          .filter({ hasText: demoSignInHelp })
          .getByText(texts.badge, { exact: true }),
      ).toBeVisible();

      const search = await hydrated(
        page.getByRole("searchbox", { name: texts.search.label }),
      );
      const edit = (of: string) =>
        page.getByRole("button", { name: t("texts.edit.label", { key: of }) });
      const sheet = page.getByRole("dialog", { name: texts.edit.title });
      const field = sheet.getByLabel(texts.edit.field);

      // Wording its code could not show is refused, and nothing changes.
      await search.fill("texts.results.more");
      await edit("texts.results.more").click();
      await field.fill("يظهر بعضها.");
      await sheet.getByRole("button", { name: texts.edit.save }).click();
      await expect(sheet.getByRole("alert")).toHaveText(
        t("texts.problems.arguments"),
      );
      await sheet.getByRole("button", { name: messages.ui.cancel }).click();
      await expect(sheet).toBeHidden();

      const wording = "كل نص في المنصة بصياغة كليتنا.";
      await search.fill(key);
      await edit(key).click();
      await field.fill(wording);
      await sheet.getByRole("button", { name: texts.edit.save }).click();
      await expect(page.getByText(texts.edit.done)).toBeVisible();
      await expect(page.locator("main")).toContainText(wording);

      await edit(key).click();
      await sheet.getByRole("button", { name: texts.edit.reset }).click();
      await expect(page.getByText(texts.edit.resetDone)).toBeVisible();
      await expect(page.locator("main")).toContainText(texts.description);
    } finally {
      await pool.query("delete from text_overrides where key = $1", [key]);
      await pool.end();
    }
  },
);

test.describe("without the control panel's keys", () => {
  test.use({ storageState: STORAGE.trainer });

  test("its pages answer with the refusal, and the shell offers none of them", async ({
    page,
  }) => {
    for (const path of ["/console", "/system", "/texts"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: pages.forbidden.title }),
        path,
      ).toBeVisible();
    }
    for (const id of ["console", "system", "texts"] as const) {
      await expect(page.getByRole("link", { name: nav[id] })).toHaveCount(0);
    }
  });
});

test("the control panel's pages have no serious accessibility issue", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/console", "/system", "/texts", "/texts?q=today"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");

  test("every enabled control of the control panel's pages has a 44 px hit area", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/console", "/system", "/texts", "/texts?q=today"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The dev server's indicator (absent from the standalone build CI tests) covers a corner.
      await page.evaluate(() =>
        document.querySelector("nextjs-portal")?.remove(),
      );
      expect(await smallTargets(page.locator("main")), path).toEqual([]);
    }
  });
});
