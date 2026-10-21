import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { documentLocale } from "@/platform/i18n/language";

// The settings screen confirms each save and reset with a toast; Sonner loads on the screens that
// show one, not on every page (ADR-0010, the script budget).
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
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
