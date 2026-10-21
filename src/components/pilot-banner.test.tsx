import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { PilotBanner } from "./pilot-banner.tsx";

const stored = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/modules/org", () => ({ findCollegeId: async () => "college-a" }));
vi.mock("@/modules/settings", () => ({
  getSetting: async (key: string) =>
    stored.has(key)
      ? stored.get(key)
      : { "pilot.banner": true, "pilot.bannerText": null }[key],
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `catalog:${key}`,
}));

beforeEach(() => stored.clear());

const render = async () => {
  const banner = await PilotBanner();
  return banner ? renderToStaticMarkup(banner) : "";
};

it("shows the catalog's words, politely, while the setting is on", async () => {
  const html = await render();
  expect(html).toContain('role="status"');
  expect(html).toContain("catalog:pilot");
});

it("shows the college's own words when it has set them", async () => {
  stored.set("pilot.bannerText", "Trial until the end of term");
  expect(await render()).toContain("Trial until the end of term");
});

it("shows nothing once the setting is off", async () => {
  stored.set("pilot.banner", false);
  expect(await render()).toBe("");
});
