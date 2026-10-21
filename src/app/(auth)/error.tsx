"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// A sign-in page that failed to render: the identity panel stays, and the page can be tried again.
export default function AuthError({ retry }: { retry: () => void }) {
  const t = useTranslations("ui.error");
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl">{t("title")}</h2>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      <Button onClick={() => retry()} className="mt-3 h-11 w-full">
        {t("retry")}
      </Button>
    </div>
  );
}
