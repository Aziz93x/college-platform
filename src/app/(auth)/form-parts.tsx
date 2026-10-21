"use client";

import { type ReactNode, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/motion/alert";
import { Loader } from "@/components/motion/loader";
import { Button } from "@/components/ui/button";

// Once the action has signed someone in or out, or shown a two-factor key, the next page loads from
// scratch: nothing typed or shown before (a password, a key) stays in the page's memory, in a page
// the router keeps hidden, or in its cache for the next person at this browser.
export function useLeaveTo(href: string | undefined) {
  useEffect(() => {
    if (href) window.location.replace(href);
  }, [href]);
}

// The form's main button: while the action runs it turns the loader and says what is happening.
export function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-11 w-full text-base"
    >
      {pending ? (
        <>
          <Loader />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

// Why the action did not go through, announced at once.
export function RefusalAlert({
  open,
  title,
  description,
  children,
}: {
  open: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Alert variant="alert" open={open} className="mb-1">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {children}
    </Alert>
  );
}
