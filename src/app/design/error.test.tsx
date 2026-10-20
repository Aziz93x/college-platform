import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import messages from "../../../messages/ar.json" with { type: "json" };
import DesignError from "./error.tsx";

// Only the ui namespace, as the root layout provides it above the error boundary.
it("says what failed and offers a retry, in the catalog's words", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="ar" messages={{ ui: messages.ui }}>
      <DesignError retry={() => {}} />
    </NextIntlClientProvider>,
  );
  const { title, description, retry } = messages.ui.error;
  expect(html).toContain(`<h1 class="text-2xl">${title}</h1>`);
  expect(html).toContain(description);
  expect(html).toMatch(new RegExp(`<button[^>]*>${retry}</button>`));
});
