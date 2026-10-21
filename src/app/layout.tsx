import "./globals.css";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Direction } from "radix-ui";
import { MotionProvider } from "@/components/motion/motion-provider";
import { PilotBanner } from "@/components/pilot-banner";
import { Toaster } from "@/components/ui/sonner";
import { documentLocale } from "@/platform/i18n/language";
import { identityFont } from "@/styles/fonts";

// <html lang dir> comes from a setting read per request and cannot wait behind a Suspense
// boundary, so no route gets a static shell (docs/ADR/0007-locale-read-per-request.md).
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The setting lives in the database, which next build does not reach.
  await connection();
  const { lang, dir } = documentLocale(await getLocale());
  const t = await getTranslations("toast");
  // Client components get only the namespaces they read, so a route's payload does not carry the
  // whole catalog; a route that needs more adds its own provider (src/app/design/page.tsx).
  const { ui } = await getMessages();
  return (
    <html
      lang={lang}
      dir={dir}
      className={`${identityFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={{ ui }}>
          <Direction.Provider dir={dir}>
            <MotionProvider>
              <PilotBanner />
              {children}
            </MotionProvider>
            <Toaster dir={dir} containerAriaLabel={t("region")} />
          </Direction.Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
