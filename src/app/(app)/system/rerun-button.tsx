"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rerunPassAction } from "./actions.ts";

// Runs a failed pass again, as a new one over its term (ADR-0029); the list then shows it waiting.
export function RerunButton({ runId, term }: { runId: string; term: string }) {
  const t = useTranslations("system.passes");
  const refusals = useTranslations("actions");
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      setRunning(true);
      const result = await rerunPassAction({ runId });
      setRunning(false);
      const status = result?.data?.status;
      if (status === "queued") toast.success(t("rerunDone", { term }));
      else if (status) toast.error(t(`refusals.${status}`));
      else toast.error(refusals(result?.serverError ?? "unexpected"));
    });
  return (
    <Button
      variant="outline"
      disabled={running}
      onClick={run}
      aria-label={t("rerunLabel", { term })}
    >
      {running ? (
        <LoaderCircle aria-hidden className="animate-spin" />
      ) : (
        <RefreshCw aria-hidden />
      )}
      {running ? t("rerunning") : t("rerun")}
    </Button>
  );
}
