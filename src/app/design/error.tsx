"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// The catalog's error state. It sits above the page, so it reads the shared ui messages that the
// root layout provides.
export default function DesignError({ retry }: { retry: () => void }) {
  const t = useTranslations("ui.error");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button onClick={() => retry()}>{t("retry")}</Button>
    </main>
  );
}
