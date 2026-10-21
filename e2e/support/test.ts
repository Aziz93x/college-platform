import { test as base, expect } from "@playwright/test";

// React's hydration warnings in development, and its minified hydration errors in production.
const HYDRATION = /hydrat|react\.dev\/errors\/(418|423|425)\b/i;

// The test every spec uses: it fails when the page logs a hydration warning or error, so a
// mismatch between the server's HTML and the first render on the client never goes unnoticed.
export const test = base.extend<{ hydration: undefined }>({
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
});

export { expect };
