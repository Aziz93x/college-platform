"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// A step back or forward in the browser's history shows its page as Next.js drew it, kept hidden
// or in its cache, and asks the server for nothing; a link back to a page reads it again on its own
// (lead review D). The step is heard from the Navigation API, which tells of it before the router
// shows the page, or else from popstate, whose listener the router added first and so shows the page
// before this one hears it; and from pageshow when the browser brings the whole document back from
// its own cache. `traversed` is the entry it went to, by the key the Navigation API keeps for it
// while the router replaces its state, or else by its address, so a link to that page later is not
// taken for it; each page shown now reads itself again when it hears of one.
type Navigation = EventTarget & { currentEntry?: { key: string } | null };
const browser = typeof window === "undefined" ? undefined : window;
const navigation = (browser as { navigation?: Navigation } | undefined)
  ?.navigation;
const entry = () => navigation?.currentEntry?.key ?? window.location.href;
let traversed: string | undefined;
const shown = new Set<() => void>();
function heard() {
  traversed = entry();
  for (const readAgain of shown) readAgain();
}
if (browser) {
  if (navigation) {
    navigation.addEventListener("currententrychange", (event) => {
      const { navigationType } = event as Event & { navigationType?: string };
      if (navigationType === "traverse") heard();
    });
  } else {
    browser.addEventListener("popstate", heard, { capture: true });
  }
  browser.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) heard();
  });
}

// Reads its page again from the server when a step back or forward shows it, whether the step is
// heard before the page shows or after, so a page of what other people have done since never shows
// the past. A page that shows answers for a step to the entry it shows on; a page already shown,
// for a step to an entry of its own address, as Next.js keeps it shown there, an earlier visit of it
// included.
export function FreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const own = window.location.href;
    const readAgain = () => {
      if (traversed !== entry() || window.location.href !== own) return;
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
