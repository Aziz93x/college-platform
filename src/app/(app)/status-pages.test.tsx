import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import messages from "../../../messages/ar.json" with { type: "json" };
import AppError from "./error.tsx";
import Forbidden from "./forbidden.tsx";

vi.mock("@/components/identity-art", () => ({ IdentityArt: () => null }));

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="ar" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );

it("says a page is outside the viewer's permissions and leads home", () => {
  const html = render(<Forbidden />);
  const { forbidden, home } = messages.pages;
  expect(html).toContain(`<h1 class="mt-6 text-2xl">${forbidden.title}</h1>`);
  expect(html).toContain(forbidden.description);
  expect(html).toMatch(new RegExp(`<a[^>]*href="/"[^>]*>${home}</a>`));
});

it("says a page in the shell failed and offers a retry, from the shared ui messages", () => {
  const html = render(<AppError retry={() => {}} />);
  const { title, description, retry } = messages.ui.error;
  expect(html).toContain(`<h1 class="mt-6 text-2xl">${title}</h1>`);
  expect(html).toContain(description);
  expect(html).toMatch(new RegExp(`<button[^>]*>${retry}</button>`));
});
