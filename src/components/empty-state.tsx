import type { ReactNode } from "react";
import { IdentityArt } from "@/components/identity-art";

// A section with nothing in it yet: what will appear here, and the next action when there is one.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="relative isolate flex flex-col items-center overflow-hidden rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-md bg-[radial-gradient(closest-side_at_50%_40%,color-mix(in_srgb,var(--gradient-end)_16%,transparent),transparent)]"
      />
      <IdentityArt
        element="curves"
        // Smaller than the text on a phone, so the text is the page's largest paint and shows at once.
        sizes="(min-width: 640px) 224px, 112px"
        className="h-auto w-28 animate-drift sm:w-56 rtl:-scale-x-100"
      />
      <h2 className="mt-6 text-lg">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground text-sm">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
