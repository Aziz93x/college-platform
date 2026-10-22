"use client";

import { CalendarDays, CalendarRange, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MorphPopover,
  MorphPopoverContent,
  MorphPopoverTrigger,
} from "@/components/motion/popover-morph";
import { cn } from "@/components/ui/cn";
import { TERM_COOKIE } from "./term-cookie.ts";

// A year: the term cookie lasts as long as the sidebar's.
const KEEP = 60 * 60 * 24 * 365;

// The term switcher in the header (Step 13, BeUI's morph popover as a select): the term the viewer
// looks at, with today's week in it, and the other terms they may see. Choosing one keeps it in a
// cookie and draws the page again, so the pages that read a term follow it; the calendar of the
// one on show is a tap away.
export function TermSwitcher({
  terms,
  viewed,
  week,
  labels,
}: {
  terms: { id: string; name: string; status: string }[];
  viewed?: { id: string; name: string };
  /** Today's week in the viewed term, in words, when today falls in it. */
  week?: string;
  labels: {
    open: string;
    list: string;
    calendar: string;
    choose: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const choose = (id: string) => {
    // biome-ignore lint/suspicious/noDocumentCookie: one choice of what to look at, read by the server's layout, as the sidebar's.
    document.cookie = `${TERM_COOKIE}=${id}; path=/; max-age=${KEEP}; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <MorphPopover open={open} onOpenChange={setOpen}>
      <MorphPopoverTrigger>
        <button
          type="button"
          aria-label={labels.open}
          className="flex h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays aria-hidden className="size-4 shrink-0" />
          <span className="hidden min-w-0 truncate font-medium md:inline">
            {viewed?.name ?? labels.choose}
          </span>
          {week ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
              {week}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="size-4 shrink-0 opacity-60" />
        </button>
      </MorphPopoverTrigger>
      <MorphPopoverContent align="end" className="w-72 p-2">
        <ul aria-label={labels.list} className="flex flex-col gap-0.5">
          {terms.map((term) => {
            const current = term.id === viewed?.id;
            return (
              <li key={term.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => choose(term.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-start text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    current && "font-medium",
                  )}
                >
                  <Check
                    aria-hidden
                    className={cn("size-4 shrink-0", !current && "invisible")}
                  />
                  <span className="min-w-0 flex-1 truncate">{term.name}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {term.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {viewed ? (
          <Link
            href={`/terms/${viewed.id}`}
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-2 rounded-lg border-t px-3 pt-1 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarRange aria-hidden className="size-4 shrink-0" />
            {labels.calendar}
          </Link>
        ) : null}
      </MorphPopoverContent>
    </MorphPopover>
  );
}
