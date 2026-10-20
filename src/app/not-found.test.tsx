import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import messages from "../../messages/ar.json" with { type: "json" };

const connection = vi.fn(async () => {});
vi.mock("next/server", () => ({ connection: () => connection() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "pages") => (key: string) =>
    key
      .split(".")
      .reduce<unknown>(
        (value, part) => (value as Record<string, unknown>)[part],
        messages[namespace],
      ),
}));
vi.mock("@/components/identity-art", () => ({ IdentityArt: () => null }));

it("waits for the request, then gives the catalog's not-found page with a way home", async () => {
  const { default: NotFound } = await import("./not-found.tsx");
  const html = renderToStaticMarkup(await NotFound());
  // The words follow the college's language setting, which next build must not read.
  expect(connection).toHaveBeenCalledOnce();
  const { notFound, home } = messages.pages;
  expect(html).toContain(notFound.code);
  expect(html).toContain(`<h1 class="mt-6 text-2xl">${notFound.title}</h1>`);
  expect(html).toContain(notFound.description);
  expect(html).toMatch(new RegExp(`<a[^>]*href="/"[^>]*>${home}</a>`));
});
