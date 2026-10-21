import { expect, it, vi } from "vitest";
import messages from "../../messages/ar.json" with { type: "json" };

vi.mock("next-intl/server", () => ({
  getRequestConfig: (create: unknown) => create,
}));
vi.mock("./locale.ts", () => ({
  loadCollegeLocale: async () => ({
    lang: "ar",
    dir: "rtl",
    timeZone: "Asia/Riyadh",
    locale: "ar-u-nu-arab",
  }),
}));

// Without a time zone, next-intl formats dates in the server's zone (UTC in the container).
it("gives next-intl the college's locale with its digits, its time zone and the language's catalog", async () => {
  const { default: requestConfig } = await import("./request.ts");
  const create = requestConfig as unknown as () => Promise<unknown>;
  await expect(create()).resolves.toEqual({
    locale: "ar-u-nu-arab",
    timeZone: "Asia/Riyadh",
    messages,
  });
});
