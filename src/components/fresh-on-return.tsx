"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// A step back or forward in the browser's history shows its page as Next.js drew it, kept hidden
// or in its cache, and asks the server for nothing; a link back to a page reads it again on its own
// (lead review D). The step is heard from the Navigation API, which tells of it before the router
// shows the page, or else from popstate, whose listener the router added first and so shows the page
// before this one hears it: `traversed` is where it went, and each page shown now reads itself
// again when it hears of one.
let traversed: string | undefined;
const shown = new Set<() => void>();
function heard() {
  traversed = window.location.href;
  for (const readAgain of shown) readAgain();
}
if (typeof window !== "undefined") {
  const { navigation } = window as { navigation?: EventTarget };
  if (navigation) {
    navigation.addEventListener("currententrychange", (event) => {
      const { navigationType } = event as Event & { navigationType?: string };
      if (navigationType === "traverse") heard();
    });
  } else {
    window.addEventListener("popstate", heard, { capture: true });
  }
}

// Reads its page again from the server when a step back or forward shows it, whether the step is
// heard before the page shows or after, so a page of what other people have done since never shows
// the past. A page answers for its own address alone.
export function FreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const own = window.location.href;
    const readAgain = () => {
      if (traversed !== own || window.location.href !== own) return;
      traversed = undefined;
      router.refresh();
    };
    readAgain();
    shown.add(readAgain);
    return () => {
      shown.delete(readAgain);
    };
  }, [router]);
  return null;
}
