import { beforeEach, expect, it, vi } from "vitest";
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
const college = vi.hoisted(() => ({ id: undefined as string | undefined }));
vi.mock("@/modules/org", () => ({ findCollegeId: async () => college.id }));
vi.mock("@/modules/texts", async (original) => ({
  ...(await original<typeof import("@/modules/texts")>()),
  collegeTexts: async () => [{ key: "nav.today", value: "يومي" }],
}));

beforeEach(() => {
  college.id = undefined;
});

const create = async () => {
  const { default: requestConfig } = await import("./request.ts");
  return (requestConfig as unknown as () => Promise<unknown>)();
};

// Without a time zone, next-intl formats dates in the server's zone (UTC in the container).
it("gives next-intl the college's locale with its digits, its time zone and the language's catalog", async () => {
  await expect(create()).resolves.toEqual({
    locale: "ar-u-nu-arab",
    timeZone: "Asia/Riyadh",
    messages,
  });
});

it("lays the college's own wording over the catalog (ADR-0029)", async () => {
  college.id = "0193a6a0-0000-7000-8000-000000000001";
  await expect(create()).resolves.toMatchObject({
    messages: { nav: { ...messages.nav, today: "يومي" } },
  });
});
