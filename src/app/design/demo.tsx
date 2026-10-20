import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

// One primitive in the catalog. data-primitive names it for the end-to-end tests.
export function Demo({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      data-primitive={id}
      aria-labelledby={`primitive-${id}`}
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <h3 id={`primitive-${id}`} className="text-lg">
        {title}
      </h3>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

// A labelled field, with its error message in --alert when it has one.
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid w-full gap-2 sm:w-56">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
