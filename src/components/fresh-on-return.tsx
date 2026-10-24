"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The address the last step back or forward in the browser's history went to. Next.js shows the
// page there as it was drawn, kept hidden or in its cache, and asks the server for nothing; a link
// back to a page reads it again on its own (lead review D). Heard in the capture phase, before the
// router's own listener, so it is known by the time the page shows.
let traversed: string | undefined;
if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    () => {
      traversed = window.location.href;
    },
    { capture: true },
  );
}

// Reads its page again from the server when a step back or forward shows it, so a page of what
// other people have done since never shows the past.
export function FreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    if (traversed !== window.location.href) return;
    traversed = undefined;
    router.refresh();
  }, [router]);
  return null;
}
