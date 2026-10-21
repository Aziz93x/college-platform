"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// A temporary password, shown once (ADR-0008: no email goes out): to read aloud or copy, left to
// right as it is typed.
export function TemporaryPassword({
  name,
  password,
}: {
  name: string;
  password: string;
}) {
  const t = useTranslations("people.temporaryPassword");
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-sm">{t("label", { name })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <output
          dir="ltr"
          className="min-w-0 flex-1 select-all rounded-lg border bg-muted px-3 py-2.5 font-mono text-base tracking-wider"
        >
          {password}
        </output>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() =>
            navigator.clipboard
              .writeText(password)
              .then(() => toast.success(t("copied")))
          }
        >
          <Copy aria-hidden />
          {t("copy")}
        </Button>
      </div>
      <p className="text-pretty text-muted-foreground text-xs">{t("hint")}</p>
    </div>
  );
}
