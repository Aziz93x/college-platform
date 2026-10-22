"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  cancelFrame,
  frame,
  MotionConfig,
  type Transition,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import {
  type ButtonHTMLAttributes,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT } from "./lib/ease.ts";

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  /** Whether a tab has been chosen since the list rendered: only then does a panel animate in. */
  changed: boolean;
  layoutId: string;
  /**
   * The one tab Tab reaches: the selected tab, or the first enabled one when
   * nothing enabled is selected. `null` until the triggers have registered,
   * when every enabled tab stays reachable.
   */
  tabStop: string | null;
  registerTab: (value: string, disabled: boolean) => void;
  unregisterTab: (value: string) => void;
  /** Values with a mounted panel, so triggers only point at panels that exist. */
  panels: ReadonlySet<string>;
  registerPanel: (value: string) => void;
  unregisterPanel: (value: string) => void;
  tabId: (value: string) => string;
  panelId: (value: string) => string;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

// Settle without overshoot: a scrollable tab list would turn even a small
// overshoot into a transient scrollbar and layout shift.
const transition: Transition = {
  type: "spring",
  stiffness: 245,
  damping: 36,
  mass: 1.2,
};

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const layoutId = useId();
  const reduce = useReducedMotion();
  const [changed, setChanged] = useState(false);
  const setValue = useCallback(
    (next: string) => {
      setChanged(true);
      onValueChange(next);
    },
    [onValueChange],
  );
  const [tabs, setTabs] = useState<Map<string, boolean>>(new Map());
  const registerTab = useCallback((tab: string, disabled: boolean) => {
    setTabs((map) =>
      map.get(tab) === disabled ? map : new Map(map).set(tab, disabled),
    );
  }, []);
  const unregisterTab = useCallback((tab: string) => {
    setTabs((map) => {
      if (!map.has(tab)) return map;
      const next = new Map(map);
      next.delete(tab);
      return next;
    });
  }, []);
  const [panels, setPanels] = useState<ReadonlySet<string>>(new Set());
  const registerPanel = useCallback((panel: string) => {
    setPanels((set) => (set.has(panel) ? set : new Set(set).add(panel)));
  }, []);
  const unregisterPanel = useCallback((panel: string) => {
    setPanels((set) => {
      if (!set.has(panel)) return set;
      const next = new Set(set);
      next.delete(panel);
      return next;
    });
  }, []);
  // Resolved during render so the list has exactly one tab stop in the same
  // commit that changes the selection or the tabs.
  let tabStop: string | null = null;
  if (tabs.size > 0) {
    const enabled = Array.from(tabs).filter(([, disabled]) => !disabled);
    tabStop = enabled.some(([tab]) => tab === value)
      ? value
      : (enabled[0]?.[0] ?? "");
  }
  const baseId = useId();
  const tabId = useCallback(
    (tab: string) => `${baseId}-tab-${tab.replace(/[^\w-]/g, "_")}`,
    [baseId],
  );
  const panelId = useCallback(
    (tab: string) => `${baseId}-panel-${tab.replace(/[^\w-]/g, "_")}`,
    [baseId],
  );
  const contextValue = useMemo(
    () => ({
      value,
      setValue,
      changed,
      layoutId,
      tabStop,
      registerTab,
      unregisterTab,
      panels,
      registerPanel,
      unregisterPanel,
      tabId,
      panelId,
    }),
    [
      value,
      setValue,
      changed,
      layoutId,
      tabStop,
      registerTab,
      unregisterTab,
      panels,
      registerPanel,
      unregisterPanel,
      tabId,
      panelId,
    ],
  );
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={contextValue}>
        {/* layoutRoot: the pill's layoutId measures in page coordinates, so inside a scrolled
            container it would replay scroll offsets as movement. The pill only travels within
            the list, so scoping projection to the Tabs wrapper is always correct. */}
        <m.div layoutRoot className={className}>
          {children}
        </m.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

export function TabsList({
  children,
  label,
  scrollLabels,
  className,
}: {
  children: ReactNode;
  /** The accessible name of the tab list. */
  label: string;
  /** The arrows that scroll a list wider than its place, named for the side they scroll to. */
  scrollLabels: { left: string; right: string };
  className?: string;
}) {
  const { value } = useTabs();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [edges, setEdges] = useState({
    overflow: false,
    left: false,
    right: false,
  });

  const measure = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    // Overlay controls do not reduce the viewport or change its scroll range.
    const overflow = viewport.scrollWidth > root.clientWidth + 1;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === "rtl";
    // Modern browsers expose negative scrollLeft in RTL. Clamp rubber-banding.
    const fromLeft = Math.max(
      0,
      Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft),
    );
    const next = { overflow, left: fromLeft > 1, right: fromLeft < max - 1 };
    setEdges((previous) =>
      previous.overflow === next.overflow &&
      previous.left === next.left &&
      previous.right === next.right
        ? previous
        : next,
    );
  }, []);

  const reveal = useCallback(
    (tab: HTMLElement | null) => {
      const viewport = viewportRef.current;
      if (!viewport || !tab) return;
      const box = viewport.getBoundingClientRect();
      const item = tab.getBoundingClientRect();
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const rtl = getComputedStyle(viewport).direction === "rtl";
      const fromLeft = Math.max(
        0,
        Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft),
      );
      // Keep the selected or focused label clear of the arrows over the faded edges.
      const left = box.left + (fromLeft > 1 ? 44 : 0);
      const right = box.right - (fromLeft < max - 1 ? 44 : 0);
      const delta =
        item.left < left
          ? item.left - left
          : item.right > right
            ? item.right - right
            : 0;
      // Scroll only this viewport; scrollIntoView can also move the whole page.
      if (delta)
        viewport.scrollBy({
          left: delta,
          behavior: reduce ? "instant" : "smooth",
        });
    },
    [reduce],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!root || !viewport || !list) return;
    const update = () => {
      measure();
      reveal(
        list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'),
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(viewport);
    observer.observe(list);
    viewport.addEventListener("scroll", measure, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, [measure, reveal]);

  useLayoutEffect(() => {
    // Children may change without a resize; a new selection must also show.
    void children;
    void value;
    void edges.overflow;
    measure();
    reveal(
      listRef.current?.querySelector<HTMLElement>(
        '[role="tab"][aria-selected="true"]',
      ) ?? null,
    );
  }, [children, value, edges.overflow, measure, reveal]);

  // The selected tab's label shows in the pill's colour only where the pill
  // covers it, so a label the pill glides across changes colour as it passes.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    void children;
    const labels = Array.from(
      list.querySelectorAll<HTMLElement>("[data-tabs-label]"),
    );
    const indicator = list.querySelector<HTMLElement>("[data-tabs-indicator]");
    const target = list.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!indicator || !target || target.dataset.tabsValue !== value) {
      for (const label of labels) label.style.clipPath = "inset(0 100% 0 0)";
      return;
    }
    let frames = 0;
    let stillFrames = 0;
    let previous: { left: number; right: number } | undefined;
    const syncClips = () => {
      const pill = (reduce ? target : indicator).getBoundingClientRect();
      // Read all geometry before writing any mask, so styles flush once.
      const clips = labels.map((label) => {
        const bounds = label.getBoundingClientRect();
        const left = Math.max(
          0,
          Math.min(bounds.width, pill.left - bounds.left),
        );
        const right = Math.max(
          0,
          Math.min(bounds.width, bounds.right - pill.right),
        );
        return left + right >= bounds.width
          ? "inset(0 100% 0 0)"
          : `inset(0 ${right}px 0 ${left}px)`;
      });
      labels.forEach((label, index) => {
        if (label.style.clipPath !== clips[index])
          label.style.clipPath = clips[index];
      });
      frames += 1;
      stillFrames =
        previous &&
        Math.abs(pill.left - previous.left) < 0.01 &&
        Math.abs(pill.right - previous.right) < 0.01
          ? stillFrames + 1
          : 0;
      previous = { left: pill.left, right: pill.right };
      if (reduce || (frames > 2 && stillFrames >= 2)) cancelFrame(syncClips);
    };
    // One shared pass after Motion paints the projected pill keeps every label
    // in sync, including labels crossed during a long or interrupted glide.
    frame.postRender(syncClips, true);
    // A list measured while hidden gets every mask closed: sync again once it has a size.
    const resync = () => {
      frames = 0;
      stillFrames = 0;
      previous = undefined;
      cancelFrame(syncClips);
      frame.postRender(syncClips, true);
    };
    const observer = new ResizeObserver(resync);
    observer.observe(list);
    return () => {
      observer.disconnect();
      cancelFrame(syncClips);
    };
  }, [value, children, reduce]);

  // Arrow keys move along the list in the reading direction and select as focus
  // arrives, wrapping at the ends; Home and End jump to the first and last tab.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list || !(event.target instanceof HTMLElement)) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).filter((tab) => !tab.disabled);
    const at = tabs.indexOf(event.target as HTMLButtonElement);
    if (at < 0) return;
    const rtl = getComputedStyle(list).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const next =
      event.key === forward
        ? tabs[(at + 1) % tabs.length]
        : event.key === back
          ? tabs[(at - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  };

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    if (viewport)
      viewport.scrollBy({
        left: direction * viewport.clientWidth * 0.8,
        behavior: reduce ? "instant" : "smooth",
      });
  };
  const controlClass =
    "absolute inset-y-0 z-20 inline-flex w-11 items-center justify-center bg-card text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-0";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative isolate flex w-full min-w-0 max-w-full items-center",
        edges.overflow && "rounded-full bg-card",
      )}
    >
      {edges.overflow && (
        <button
          type="button"
          aria-label={scrollLabels.left}
          aria-controls={viewportId}
          disabled={!edges.left}
          onClick={() => scroll(-1)}
          className={cn(controlClass, "left-0 rounded-l-full")}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
      )}
      <m.div
        ref={viewportRef}
        id={viewportId}
        layoutScroll
        className={cn(
          "w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          edges.overflow && "[border-radius:inherit]",
        )}
        style={
          edges.overflow
            ? {
                // The fade starts past each opaque chevron, so no label shows half under one.
                maskImage: `linear-gradient(to right, ${edges.left ? "transparent 44px, black 72px" : "black, black 0px"}, ${edges.right ? "black calc(100% - 72px), transparent calc(100% - 44px)" : "black 100%"})`,
              }
            : undefined
        }
        onFocusCapture={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.matches('[role="tab"]')
          )
            reveal(event.target);
        }}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className={cn(
            "inline-flex w-max items-center gap-1 rounded-full border bg-card p-1 shadow-xs",
            className,
          )}
        >
          {children}
        </div>
      </m.div>
      {edges.overflow && (
        <button
          type="button"
          aria-label={scrollLabels.right}
          aria-controls={viewportId}
          disabled={!edges.right}
          onClick={() => scroll(1)}
          className={cn(controlClass, "right-0 rounded-r-full")}
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      )}
    </div>
  );
}

export function TabsTrigger({
  value,
  icon,
  children,
  className,
  onClick,
  ...props
}: {
  value: string;
  /** An icon before the label, such as a Lucide icon element. */
  icon?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value">) {
  const {
    value: current,
    setValue,
    layoutId,
    tabStop,
    registerTab,
    unregisterTab,
    panels,
    tabId,
    panelId,
  } = useTabs();
  const active = current === value;
  const disabled = Boolean(props.disabled);
  useLayoutEffect(() => {
    registerTab(value, disabled);
  }, [registerTab, value, disabled]);
  useLayoutEffect(() => () => unregisterTab(value), [unregisterTab, value]);
  const content = icon ? (
    <>
      <span aria-hidden className="inline-flex shrink-0 items-center">
        {icon}
      </span>
      {children}
    </>
  ) : (
    children
  );
  // React owns the initial mask only; TabsList keeps the masks in step after that.
  const [initialClip] = useState(() =>
    active ? "inset(0)" : "inset(0 100% 0 0)",
  );

  return (
    <div className="relative shrink-0">
      {active ? (
        <m.span
          data-tabs-indicator=""
          layoutId={layoutId}
          layout
          // Layout animations correct only a radius set inline.
          style={{ borderRadius: 9999 }}
          className="absolute inset-0 rounded-full bg-primary"
        />
      ) : null}
      <button
        id={tabId(value)}
        aria-controls={panels.has(value) ? panelId(value) : undefined}
        tabIndex={!disabled && (tabStop === null || tabStop === value) ? 0 : -1}
        {...props}
        type="button"
        role="tab"
        aria-selected={active}
        data-tabs-value={value}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setValue(value);
        }}
        className={cn(
          "relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-transparent px-4 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 [&_svg]:size-4",
          className,
        )}
      >
        {content}
        <span
          data-tabs-label=""
          aria-hidden
          inert
          className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-primary-foreground [gap:inherit] [padding:inherit]"
          style={{ clipPath: initialClip }}
        >
          {content}
        </span>
      </button>
    </div>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const {
    value: current,
    changed,
    registerPanel,
    unregisterPanel,
    tabId,
    panelId,
  } = useTabs();
  const reduce = useReducedMotion();
  const active = current === value;
  useLayoutEffect(() => {
    registerPanel(value);
    return () => unregisterPanel(value);
  }, [registerPanel, unregisterPanel, value]);
  const a11y = {
    id: panelId(value),
    role: "tabpanel",
    "aria-labelledby": tabId(value),
  } as const;
  // Inactive panels stay in the page, hidden, so the server's HTML holds every group.
  if (!active) {
    return (
      <div {...a11y} hidden className={className}>
        {children}
      </div>
    );
  }
  return (
    <m.div
      {...a11y}
      key={value}
      // The panel the page opens on is drawn as the server sent it; one chosen later fades in.
      initial={changed ? { opacity: 0, y: reduce ? 0 : 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={cn("outline-none", className)}
    >
      {children}
    </m.div>
  );
}
