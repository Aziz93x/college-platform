import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  // A language other than the default, so a hard-coded lang or dir fails.
  getLocale: async () => "en",
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({
    ui: { close: "Close" },
    toast: { region: "Notifications" },
    design: { title: "Design" },
  }),
}));
vi.mock("@/styles/fonts", () => ({
  identityFont: { variable: "identity-font" },
}));

type Element = ReactElement<{
  children?: Element;
  lang?: string;
  dir?: string;
  messages?: unknown;
}>;

it("takes <html lang dir> from the language next-intl reads from the settings", async () => {
  const { default: RootLayout } = await import("./layout.tsx");
  const html = (await RootLayout({
    children: null,
    params: Promise.resolve({}),
  })) as Element;
  expect(html.props).toMatchObject({ lang: "en", dir: "ltr" });

  // Client components receive the shared namespaces only, never the whole catalog.
  const provider = html.props.children?.props.children;
  expect(provider?.props.messages).toEqual({ ui: { close: "Close" } });
});
