"use client";

import { useTranslations } from "next-intl";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

// A page in the shell that failed to render: the shell stays, and the page can be tried again. It
// reads the shared ui messages that the root layout provides to client components.
export default function AppError({ retry }: { retry: () => void }) {
  const t = useTranslations("ui.error");
  return (
    <StatusPage
      title={t("title")}
      description={t("description")}
      action={<Button onClick={() => retry()}>{t("retry")}</Button>}
    />
  );
}
