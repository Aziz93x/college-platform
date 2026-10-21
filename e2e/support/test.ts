import { test as base, expect } from "@playwright/test";

// React's hydration warnings in development, and its minified hydration errors in production.
const HYDRATION = /hydrat|react\.dev\/errors\/(418|423|425)\b/i;

// The test every spec uses. It fails when the page logs a hydration warning or error, so a mismatch
// between the server's HTML and the first render on the client never goes unnoticed. It also fails
// when the page asks for anything outside the platform's own origin, which the browser is not let
// fetch: the platform may run on an isolated network (ADR-0008).
export const test = base.extend<{
  hydration: undefined;
  ownOrigin: undefined;
}>({
  hydration: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (HYDRATION.test(message.text())) problems.push(message.text());
      });
      page.on("pageerror", (error) => {
        if (HYDRATION.test(error.message)) problems.push(error.message);
      });
      await use(undefined);
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
  ownOrigin: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL ?? "").origin;
      const outside: string[] = [];
      await context.route(
        (url) => url.origin !== origin,
        (route) => {
          outside.push(route.request().url());
          return route.abort("blockedbyclient");
        },
      );
      await use(undefined);
      expect(outside, "requests outside the platform's origin").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
