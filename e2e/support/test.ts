import { test as base, expect, type Request } from "@playwright/test";

// React's hydration warnings in development, and its minified hydration errors in production.
const HYDRATION = /hydrat|react\.dev\/errors\/(418|423|425)\b/i;

// The test every spec uses. It fails when the page logs a hydration warning or error, so a mismatch
// between the server's HTML and the first render on the client never goes unnoticed. It also fails
// when the page asks for anything outside the platform's own origin: the platform may run on an
// isolated network (ADR-0008).
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
  // Listened to, not routed: a route sends every request through this process and slows each page.
  ownOrigin: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL ?? "").origin;
      const outside: string[] = [];
      const record = (request: Request) => {
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
          outside.push(request.url());
        }
      };
      context.on("request", record);
      await use(undefined);
      context.off("request", record);
      expect(outside, "requests outside the platform's origin").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
