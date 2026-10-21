import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { documentLocale } from "@/platform/i18n/language";

// The layout of a screen that confirms its saves with a toast: Sonner loads on the screens that
// show one, not on every page (ADR-0010, the script budget).
export async function ToasterLayout({ children }: { children: ReactNode }) {
  // The locale is a college setting in the database, which next build does not reach.
  await connection();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("toast"),
  ]);
  return (
    <>
      {children}
      <Toaster
        dir={documentLocale(locale).dir}
        containerAriaLabel={t("region")}
      />
    </>
  );
}
