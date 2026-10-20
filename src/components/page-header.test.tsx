import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PageHeader } from "./page-header.tsx";

vi.mock("@/components/identity-art", () => ({ IdentityArt: () => null }));

it("shows the trail above the title, links the pages above and marks the current one", () => {
  const html = renderToStaticMarkup(
    <PageHeader
      title="Department"
      breadcrumbs={[
        { label: "Admin" },
        { label: "Departments", href: "/departments" },
      ]}
      breadcrumbsLabel="Trail"
    />,
  );
  expect(html).toContain('<nav aria-label="Trail"');
  expect(html).toMatch(/<span>Admin<\/span>/);
  expect(html).toMatch(/<a[^>]*href="\/departments"[^>]*>Departments<\/a>/);
  expect(html).toMatch(/<li aria-current="page"[^>]*>Department<\/li>/);
  expect(html.indexOf("<nav")).toBeLessThan(html.indexOf("<h1"));
});

it("has no trail on a top-level page, and shows the eyebrow and description when given", () => {
  const html = renderToStaticMarkup(
    <PageHeader title="Today" eyebrow="Good morning" description="Now" />,
  );
  expect(html).not.toContain("<nav");
  expect(html).toContain("Good morning");
  expect(html).toMatch(/<h1[^>]*>Today<\/h1>/);
  expect(html).toContain("Now");
});
