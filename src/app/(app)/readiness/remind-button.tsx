"use client";

import { BellRing, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RowKey } from "@/modules/readiness";
import { remindOwnersAction } from "./actions.ts";

// Reminds an open row's owners of it, once a day each (lead review D, proposal 5); the toast says
// how many it reached.
export function RemindButton({
  termId,
  row,
  title,
}: {
  termId: string;
  row: RowKey;
  title: string;
}) {
  const t = useTranslations("readiness.remind");
  const actions = useTranslations("actions");
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const remind = () =>
    startTransition(async () => {
      setRunning(true);
      const result = await remindOwnersAction({ termId, row });
      setRunning(false);
      const data = result?.data;
      if (data?.status === "reminded") {
        if (data.count > 0) toast.success(t("done", { count: data.count }));
        else toast(t("none"));
      } else if (data) toast.error(t(`refusals.${data.status}`));
      else toast.error(actions(result?.serverError ?? "unexpected"));
    });
  return (
    <Button
      variant="ghost"
      disabled={running}
      onClick={remind}
      aria-label={t("label", { title })}
    >
      {running ? (
        <LoaderCircle aria-hidden className="animate-spin" />
      ) : (
        <BellRing aria-hidden />
      )}
      {t("button")}
    </Button>
  );
}
