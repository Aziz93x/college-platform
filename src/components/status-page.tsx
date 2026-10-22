import type { ReactNode } from "react";
import { IdentityArt } from "@/components/identity-art";

// A page that has nothing to show but a state: not found, no permission, an error. The code is
// decoration in the identity gradient (hidden from assistive technology); the title says what
// happened and the action says what to do next.
export function StatusPage({
  code,
  title,
  description,
  action,
}: {
  code?: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-[70dvh] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <IdentityArt
        element="curves"
        sizes="(min-width: 768px) 768px, 100vw"
        className="fade-in absolute inset-x-0 bottom-0 -z-10 mx-auto h-auto w-full max-w-3xl animate-in opacity-40 duration-(--duration-slow) rtl:-scale-x-100"
      />
      {code ? (
        <p
          aria-hidden
          className="fade-in slide-in-from-bottom-3 animate-in bg-clip-text text-display text-transparent tracking-tight duration-(--duration-slow) ltr:bg-linear-to-r rtl:bg-linear-to-l from-gradient-start to-gradient-end"
        >
          {code}
        </p>
      ) : null}
      <h1 className="mt-6 text-2xl">{title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{description}</p>
      <div className="mt-8">{action}</div>
    </div>
  );
}
