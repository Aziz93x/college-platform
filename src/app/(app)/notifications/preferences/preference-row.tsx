"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/motion/switch";
import { chooseNotificationAction } from "../actions.ts";

// One kind of notification: what it is, when it comes, and whether it reaches the person in the
// platform. The switch moves at once; a refusal moves it back and says why.
export function PreferenceRow({
  kind,
  enabled,
  words,
}: {
  kind: string;
  enabled: boolean;
  words: {
    label: string;
    hint: string;
    channel: string;
    saved: string;
    refused: string;
  };
}) {
  const id = useId();
  const [shown, setShown] = useOptimistic(enabled);
  const [, startTransition] = useTransition();
  const choose = (next: boolean) =>
    startTransition(async () => {
      setShown(next);
      const result = await chooseNotificationAction({ kind, enabled: next });
      if (result?.data) toast.success(words.saved);
      else toast.error(words.refused);
    });
  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="font-medium text-sm">
          {words.label}
        </p>
        <p
          id={`${id}-hint`}
          className="mt-0.5 text-muted-foreground text-sm leading-relaxed"
        >
          {words.hint}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-muted-foreground text-xs sm:inline">
          {words.channel}
        </span>
        <Switch
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          checked={shown}
          onCheckedChange={choose}
        />
      </div>
    </li>
  );
}
