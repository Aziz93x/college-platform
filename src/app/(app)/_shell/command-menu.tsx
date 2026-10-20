"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ShellLink } from "./navigation.ts";

const loadPalette = () => import("@/components/motion/command-palette");

// The palette's code stays out of the page's first load: it loads when the browser is idle, or on
// the first request for it.
const CommandPalette = dynamic(
  () => loadPalette().then((mod) => mod.CommandPalette),
  { ssr: false },
);

const SHORTCUT = "k";

const OpenCommandMenu = createContext<() => void>(() => {});

type Labels = {
  dialog: string;
  placeholder: string;
  list: string;
  empty: string;
  close: string;
  escape: string;
  hints: { move: string; open: string; close: string };
  keys: { up: string; down: string; enter: string };
};

const KEY = "rounded-sm border border-b-2 bg-background px-1.5 font-sans";

// How to use the palette from the keyboard; a touch screen has none, so it shows there no hints.
function KeyboardHints({ hints, keys, escape: escapeKey }: Labels) {
  return (
    <p className="flex items-center gap-4 pointer-coarse:hidden">
      <span className="flex items-center gap-1">
        <kbd className={KEY}>{keys.up}</kbd>
        <kbd className={KEY}>{keys.down}</kbd>
        {hints.move}
      </span>
      <span className="flex items-center gap-1">
        <kbd className={KEY}>{keys.enter}</kbd>
        {hints.open}
      </span>
      <span className="flex items-center gap-1">
        <kbd className={KEY}>{escapeKey}</kbd>
        {hints.close}
      </span>
    </p>
  );
}

// The command palette over the shell: Ctrl or ⌘ K, or the search button, lists the pages the
// viewer may open, and choosing one opens it.
export function CommandMenu({
  links,
  labels,
  children,
}: {
  links: ShellLink[];
  labels: Labels;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const router = useRouter();
  const items = useMemo(
    () =>
      links.map((link) => ({
        id: link.id,
        label: link.label,
        icon: link.icon,
        onSelect: () => router.push(link.href),
      })),
    [links, router],
  );
  const show = useCallback(() => {
    setRequested(true);
    setOpen(true);
  }, []);

  // Until the palette is first requested, the shortcut is answered here; from then on the palette
  // answers it.
  useEffect(() => {
    if (requested) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === SHORTCUT
      ) {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requested, show]);

  // Fetch the palette's code once the page is idle, so the first open does not wait for it.
  useEffect(() => {
    if (!("requestIdleCallback" in window)) {
      const timer = setTimeout(loadPalette, 2000);
      return () => clearTimeout(timer);
    }
    const idle = requestIdleCallback(() => void loadPalette());
    return () => cancelIdleCallback(idle);
  }, []);

  return (
    <OpenCommandMenu value={show}>
      {children}
      {requested ? (
        <CommandPalette
          items={items}
          shortcut={SHORTCUT}
          open={open}
          onOpenChange={setOpen}
          placeholder={labels.placeholder}
          emptyMessage={labels.empty}
          labels={labels}
          footer={<KeyboardHints {...labels} />}
        />
      ) : null}
    </OpenCommandMenu>
  );
}

// Opens the command palette. On a phone it is an icon; from lg up it shows its label and the
// keyboard shortcut of the platform it runs on.
export function SearchButton({
  label,
  shortcuts,
}: {
  label: string;
  shortcuts: { ctrl: string; meta: string };
}) {
  const open = use(OpenCommandMenu);
  const [apple, setApple] = useState(false);
  useEffect(() => {
    setApple(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return (
    <button
      type="button"
      // A tap does not focus a button on every phone; focused, it is where the palette returns
      // focus when it closes.
      onClick={(event) => {
        event.currentTarget.focus();
        open();
      }}
      aria-keyshortcuts="Control+K Meta+K"
      className="relative flex size-11 items-center justify-center gap-3 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-10 lg:w-80 lg:justify-start lg:border lg:bg-card lg:px-3 lg:shadow-xs"
    >
      <Search aria-hidden className="size-5 lg:size-4" />
      <span className="sr-only text-sm lg:not-sr-only lg:flex-1 lg:text-start">
        {label}
      </span>
      <kbd
        dir="ltr"
        className="hidden rounded-sm border bg-background px-1.5 py-0.5 text-xs lg:inline-block"
      >
        {apple ? shortcuts.meta : shortcuts.ctrl}
      </kbd>
    </button>
  );
}
