import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { TabBar } from "./tab-bar.tsx";

vi.mock("next/navigation", () => ({ usePathname: () => "/page-2" }));

const links = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `page-${index + 1}`,
    href: `/page-${index + 1}`,
    label: `Page ${index + 1}`,
    icon: null,
  }));
const labels = {
  navigation: "Navigation",
  more: "More",
  moreTitle: "Other pages",
  close: "Close",
};
const tabs = (html: string) =>
  [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(([, href]) => href);

it("shows up to five pages as tabs and marks the open one", () => {
  const html = renderToStaticMarkup(
    <TabBar links={links(5)} labels={labels} />,
  );
  expect(tabs(html)).toEqual([
    "/page-1",
    "/page-2",
    "/page-3",
    "/page-4",
    "/page-5",
  ]);
  expect(html).toMatch(/<a [^>]*aria-current="page"[^>]*href="\/page-2"/);
  expect(html).not.toContain("aria-haspopup");
});

it("beyond five pages keeps four tabs and a fifth that opens the sheet with the rest", () => {
  const html = renderToStaticMarkup(
    <TabBar links={links(7)} labels={labels} />,
  );
  expect(tabs(html)).toEqual(["/page-1", "/page-2", "/page-3", "/page-4"]);
  expect(html).toMatch(
    /<button [^>]*aria-haspopup="dialog" aria-expanded="false"[^>]*>.*More<\/span><\/button>/,
  );
});
