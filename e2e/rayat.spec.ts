import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import writeExcelFile from "write-excel-file/node";
import { demoAccounts } from "../db/seed/demo/accounts.ts";
import { demoDepartments } from "../db/seed/demo/departments.ts";
import { createRandom } from "../db/seed/demo/random.ts";
import { demoRayatFiles, demoVisitor } from "../db/seed/demo/rayat.ts";
import { rayatColumns, rayatHeaders } from "../db/seed/rayat-columns.ts";
import messages from "../messages/ar.json" with { type: "json" };
import { joinRole } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import type { RayatKind } from "../src/modules/rayat/index.ts";
import { settingsRegistry } from "../src/modules/settings/index.ts";
import { activeTerm } from "../src/modules/terms/index.ts";
import { createDb } from "../src/platform/db/client.ts";
import { type TestAccount, test } from "./support/accounts.ts";
import { demo, STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { signedIn } from "./support/pages.ts";
import { expect } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

const { rayat: text, pages } = messages;
const t = createTranslator({
  locale: `ar-u-nu-${settingsRegistry["locale.digits"].default}`,
  messages,
  namespace: "rayat",
});
// Tests that write to the database, which the stack's smoke cannot reach.
const DATABASE = { tag: "@database" };
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Where SS01 writes a row's section reference.
const REF = rayatHeaders.ss01.indexOf(rayatColumns.ss01.sectionRef);

// A vice-dean of the test's own, a draft term of its own on view, and its imports, taken away
// afterwards: the desktop and the phone run side by side.
async function viceDeanWithTerm(account: () => Promise<TestAccount>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
  const { db, pool } = createDb(url);
  const collegeId = (await findCollegeId(db)) ?? "";
  const person = await account();
  await joinRole(
    { userId: person.userId, collegeId, role: { key: "vice-dean" } },
    db,
  );
  const name = `فصل رايات ${randomInt(100_000, 999_999)}`;
  const {
    rows: [term],
  } = await pool.query(
    "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, '2032-01-04', 18) returning id",
    [collegeId, name],
  );
  return {
    person,
    name,
    termId: term.id as string,
    pool,
    remove: async () => {
      // Applying SS01 queues a pass of the generation engine over the term (Step 20).
      for (const table of ["generation_runs", "rayat_imports"]) {
        await pool.query(`delete from ${table} where term_id = $1`, [term.id]);
      }
      await pool.query("delete from terms where id = $1", [term.id]);
      await pool.end();
    },
  };
}

// A report as Rayat exports it, in XLSX.
const xlsx = async (kind: RayatKind, table: string[][]) => ({
  name: `${kind}.xlsx`,
  mimeType: XLSX,
  buffer: await writeExcelFile(table).toBuffer(),
});

// Sends a report's file from its section of the page and checks it.
async function check(report: Locator, file: Awaited<ReturnType<typeof xlsx>>) {
  await report.getByLabel(text.upload.file).setInputFiles(file);
  await report.getByRole("button", { name: text.upload.check }).click();
}

const region = (page: Page, kind: RayatKind) =>
  page.getByRole("region", { name: text.reports[kind].title });

// What a report's versions show under a label, in the page's order (ADR-0019).
const facts = (report: Locator, label: string) =>
  report.locator(`dt:text-is("${label}") + dd`);

test(
  "the vice-dean imports a term's SS01, SF01 and SO01 from XLSX files, reviewing each diff, then rolls back a newer SS01 (Step 16)",
  DATABASE,
  async ({ browser, account, hasTouch }) => {
    const made = await viceDeanWithTerm(account);
    try {
      const files = demoRayatFiles(
        createRandom(16),
        { name: made.name, code: "14531" },
        [
          {
            rayatValue: demoDepartments[1].rayatValues[0],
            trainers: [{ employeeNumber: "200004", name: "مدرب" }],
          },
        ],
      );
      const page = await signedIn(browser, {
        identifier: made.person.employeeNumber,
        password: made.person.password,
      });
      await page
        .context()
        .addCookies([
          { name: "term", value: made.termId, url: new URL(page.url()).origin },
        ]);
      await page.goto("/rayat");
      await expect(
        page.getByRole("heading", { level: 1, name: text.title }),
      ).toBeVisible();
      for (const kind of ["ss01", "sf01", "so01"] as const) {
        await expect(region(page, kind)).toContainText(text.current.none);
      }
      expect(await seriousViolations(page)).toEqual([]);
      if (hasTouch) {
        expect(await smallTargets(page.locator("main"))).toEqual([]);
      }
      // The check wrote the page's Arabic in Latin letters.
      await page.reload();

      // A file of another term is refused, and nothing of it kept.
      const ss01 = region(page, "ss01");
      await check(
        ss01,
        await xlsx(
          "ss01",
          files.ss01.map((row, at) =>
            at === 0
              ? row
              : row.map((cell) => (cell === made.name ? "فصل آخر" : cell)),
          ),
        ),
      );
      await expect(ss01.getByRole("alert")).toContainText(
        t("upload.otherTerm", { term: "فصل آخر", viewed: made.name }),
      );

      const sections = new Set(files.ss01.slice(1).map((row) => row[REF])).size;
      const counts: Record<RayatKind, number> = {
        ss01: sections,
        sf01: files.sf01.length - 1,
        so01: files.so01.length - 1,
      };
      for (const kind of ["ss01", "sf01", "so01"] as const) {
        const report = region(page, kind);
        await check(report, await xlsx(kind, files[kind]));
        await expect(report).toContainText(text.pending.title);
        await expect(report).toContainText(
          t("diff.added", { count: counts[kind] }),
        );
        if (kind === "ss01") {
          expect(await seriousViolations(page)).toEqual([]);
          if (hasTouch) {
            expect(await smallTargets(page.locator("main"))).toEqual([]);
          }
          await page.reload();
        }
        await report.getByRole("button", { name: text.pending.apply }).click();
        await expect(report).toContainText(
          t(`records.${kind}`, { count: counts[kind] }),
        );
        await expect(report).not.toContainText(text.pending.title);
      }

      // A newer SS01 without its last section, applied, then rolled back.
      const last = files.ss01.at(-1)?.[REF];
      await check(
        ss01,
        await xlsx(
          "ss01",
          files.ss01.filter((row) => row[REF] !== last),
        ),
      );
      await expect(ss01).toContainText(t("diff.removed", { count: 1 }));
      await ss01.getByRole("button", { name: text.pending.apply }).click();
      await expect(ss01).toContainText(
        t("records.ss01", { count: sections - 1 }),
      );
      await ss01.getByRole("button", { name: text.rollback.button }).click();
      const sheet = page.getByRole("dialog", {
        name: t("rollback.title", { report: text.reports.ss01.title }),
      });
      await sheet.getByRole("button", { name: text.rollback.confirm }).click();
      await expect(page.getByText(text.rollback.done)).toBeVisible();
      await expect(ss01).toContainText(t("records.ss01", { count: sections }));
      await expect(ss01).toContainText(text.history.rolledBack);

      // Nothing but the columns the import reads was kept.
      const { rows } = await made.pool.query(
        `select count(*)::int as kept from rayat_enrollments e
         join rayat_imports i on i.id = e.import_id where i.term_id = $1`,
        [made.termId],
      );
      expect(rows).toEqual([{ kept: counts.sf01 }]);
    } finally {
      await made.remove();
    }
  },
);

test(
  "the head of Electrical, whose role the admin gave the key, imports the college's reports too: their page, and a file checked for the term on view (ADR-0019)",
  DATABASE,
  async ({ browser }) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { db, pool } = createDb(url);
    const term = await activeTerm((await findCollegeId(db)) ?? "", db);
    await pool.end();
    if (!term) throw new Error("e2e: run pnpm seed:demo first");
    const page = await signedIn(
      browser,
      { identifier: demoAccounts.head.employeeNumber, password: demo.password },
      Buffer.from(demo.totpSecret),
    );
    await page.goto("/rayat");
    await expect(
      page.getByRole("heading", { level: 1, name: text.title }),
    ).toBeVisible();
    await expect(
      facts(region(page, "sf01"), text.facts.uploadedBy).last(),
    ).toHaveText(demoAccounts.head.name);

    // Another term's file, which the check refuses before it keeps anything.
    const files = demoRayatFiles(
      createRandom(16),
      { name: "فصل آخر", code: "14531" },
      [
        {
          rayatValue: demoDepartments[1].rayatValues[0],
          trainers: [{ employeeNumber: "200004", name: "مدرب" }],
        },
      ],
    );
    const ss01 = region(page, "ss01");
    await check(ss01, await xlsx("ss01", files.ss01));
    await expect(ss01.getByRole("alert")).toContainText(
      t("upload.otherTerm", { term: "فصل آخر", viewed: term.name }),
    );
  },
);

test.describe("the admin", () => {
  test.use({ storageState: STORAGE.admin });

  test("sees the demo term's reports applied, who uploaded and applied each, and a newer SF01 waiting with what it changes", async ({
    page,
  }) => {
    await page.goto("/rayat");
    for (const kind of ["ss01", "sf01", "so01"] as const) {
      await expect(region(page, kind)).toContainText(text.current.title);
      await expect(region(page, kind)).not.toContainText(text.current.none);
    }
    // The vice-dean uploaded and applied SS01 and SF01; the head uploaded SO01, which the vice-dean
    // applied, and the SF01 waiting (ADR-0019).
    const { head, viceDean } = demoAccounts;
    const ss01 = region(page, "ss01");
    const so01 = region(page, "so01");
    const sf01 = region(page, "sf01");
    await expect(facts(ss01, text.facts.updated)).toHaveCount(1);
    await expect(facts(ss01, text.facts.uploadedBy)).toHaveText([
      viceDean.name,
    ]);
    await expect(facts(ss01, text.facts.appliedBy)).toHaveCount(0);
    await expect(facts(so01, text.facts.uploadedBy)).toHaveText([head.name]);
    await expect(facts(so01, text.facts.appliedBy)).toHaveText([viceDean.name]);
    await expect(facts(sf01, text.facts.uploadedBy)).toHaveText([
      viceDean.name,
      head.name,
    ]);
    await expect(facts(sf01, text.facts.uploadedAt)).toHaveCount(1);
    // The trainer SS01 names who is not on the platform, with their sections (Step 17).
    await expect(ss01).toContainText(text.unmatched.title);
    await expect(ss01).toContainText(demoVisitor.employeeNumber);
    await expect(sf01).toContainText(text.pending.title);
    await expect(sf01).toContainText(t("diff.added", { count: 2 }));
    // What changed opens as the log's rows do, its button saying it is open (UX review 2).
    const samples = sf01.getByRole("button", { name: text.diff.samples });
    await samples.click();
    await expect(samples).toHaveAttribute("aria-expanded", "true");
    await expect(sf01.getByText(/^تغيّر حالة التسجيل/).first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    // The admin adds the visitor from their line, their number, department and role filled in
    // (ADR-0022).
    await page.reload();
    await region(page, "ss01")
      .getByRole("link", {
        name: t("unmatched.add", { number: demoVisitor.employeeNumber }),
      })
      .click();
    await expect(page).toHaveURL(/\/people\/new\?/);
    await expect(
      page.getByLabel(messages.people.person.employeeNumber),
    ).toHaveValue(demoVisitor.employeeNumber);
    await expect(page.locator("main")).toContainText(demoVisitor.department);
  });
});

test.describe("without the Rayat key", () => {
  test.use({ storageState: STORAGE.trainer });

  test("a trainer is refused the Rayat page", async ({ page }) => {
    await page.goto("/rayat");
    await expect(
      page.getByRole("heading", { name: pages.forbidden.title }),
    ).toBeVisible();
  });
});
