"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";

// A change confirmed in a sheet that names what it changes, as every change others feel is (UX
// review 2, C1): revoking an assignment, taking an item out of a template, deleting a template. The
// action answers with the words of its refusal, or none once it is done.
export function ConfirmButton({
  label,
  name,
  icon,
  title,
  description,
  confirm,
  running,
  done,
  run,
}: {
  /** The button's words; none for an icon alone, in a row of a list. */
  label?: string;
  /** The button's name for screen readers, which names what it changes. */
  name: string;
  icon: ReactNode;
  title: string;
  description: string;
  confirm: string;
  running: string;
  done: string;
  run: () => Promise<string | undefined>;
}) {
  const ui = useTranslations("ui");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const go = () =>
    startTransition(async () => {
      setBusy(true);
      setError(undefined);
      const refusal = await run();
      setBusy(false);
      if (refusal) {
        setError(refusal);
        return;
      }
      toast.success(done);
      setOpen(false);
    });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={label ? "default" : "icon"}
        aria-label={name}
        onClick={() => setOpen(true)}
      >
        {icon}
        {label}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={title}
          description={description}
          closeLabel={ui("close")}
        >
          <div className="flex flex-col gap-4 pt-2 pb-2">
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="button"
                onClick={go}
                disabled={busy}
                value={busy ? "running" : "idle"}
                items={[
                  { id: "idle", label: confirm, icon },
                  {
                    id: "running",
                    label: running,
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
