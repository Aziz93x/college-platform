"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markReadAction } from "./actions.ts";

// Marks every unread notification read, and says so.
export function MarkAllRead({
  label,
  done,
  className,
}: {
  label: string;
  done: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await markReadAction({});
          if (result?.data) toast.success(done);
        })
      }
    >
      <CheckCheck aria-hidden />
      {label}
    </Button>
  );
}
