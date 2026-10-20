import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { languages } from "@/platform/i18n/language";

vi.mock("./globals.css", () => ({}));
vi.mock("@/styles/fonts", () => ({
  identityFont: { variable: "identity-font" },
}));
// It must not read the database: the module that reads it would throw here.
vi.mock("@/platform/db/client", () => {
  throw new Error("global-error must not import the database client");
});

it("renders its own document in the default language, with that catalog's words", async () => {
  const { default: GlobalError } = await import("./global-error.tsx");
  const html = renderToStaticMarkup(<GlobalError retry={() => {}} />);
  const catalog = JSON.parse(
    readFileSync(
      new URL(`../../messages/${languages[0]}.json`, import.meta.url),
      "utf8",
    ),
  );
  const { title, description, retry } = catalog.ui.error;
  expect(html).toMatch(new RegExp(`^<html lang="${languages[0]}" dir="rtl"`));
  expect(html).toContain(`<h1 class="text-2xl">${title}</h1>`);
  expect(html).toContain(description);
  expect(html).toMatch(new RegExp(`<button[^>]*>${retry}</button>`));
});
