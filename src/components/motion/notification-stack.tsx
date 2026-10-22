"use client";

import { ArrowUpRight, BellOff } from "lucide-react";
import { type Transition, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { ActionSwapText } from "./action-swap.tsx";
import { EASE_OUT, SPRING_LAYOUT } from "./lib/ease.ts";
import { useDismiss } from "./lib/use-dismiss.ts";
import { useHoverGesture } from "./lib/use-hover-gesture.ts";
import { useTapGesture } from "./lib/use-tap-gesture.ts";

export type NotificationStackItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  /** The page the card opens. */
  href: string;
};

export interface NotificationStackProps {
  items: NotificationStackItem[];
  /** A card opening, before its link is followed: preventDefault to follow it some other way. */
  onOpen?: (
    item: NotificationStackItem,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void;
  onViewAll?: () => void;
  maxVisible?: number;
  /** How many there are, in the page's digits. */
  count: string;
  labels: {
    /** The footer beside the count while the stack is closed. */
    collapsed: string;
    /** The footer once it is open: what a second activation does. */
    viewAll: string;
    /** Shown when there is nothing to stack. */
    empty: string;
    /** The footer's name while closed and once open, with the count. */
    expand: string;
    open: string;
  };
  className?: string;
}

const STACK_PEEK = 8;
const STACK_INSET = 12;

function NotificationCardContent({ item }: { item: NotificationStackItem }) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5 py-3.5">
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 font-medium text-sm leading-snug">
          {item.title}
        </span>
        {item.trailing ? (
          <span className="shrink-0 text-muted-foreground text-xs">
            {item.trailing}
          </span>
        ) : null}
      </span>
      {item.description ? (
        <span className="text-muted-foreground text-xs leading-relaxed">
          {item.description}
        </span>
      ) : null}
    </span>
  );
}

// Cards stacked behind the newest, each a link to what it is about, which spring apart into a list
// on hover, keyboard focus or a tap on the stack's foot; the foot's second activation opens the
// whole list (onViewAll). Closed, the newest card opens with one tap (ADR-0015).
export function NotificationStack({
  items,
  onOpen,
  onViewAll,
  maxVisible = 3,
  count,
  labels,
  className,
}: NotificationStackProps) {
  const reduce = useReducedMotion();
  const listId = useId();
  const hasFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLButtonElement>(null);
  const hover = useHoverGesture();
  // What the last gesture on the foot was, and whether the stack was already
  // expanded when that gesture started. A click reports neither.
  const tap = useTapGesture<boolean>();
  const [isExpanded, setIsExpanded] = useState(false);
  // Set by the tap that expands the stack, and the reason the outside-tap
  // dismisser exists at all — a hovering pointer has its own way out.
  const [tapExpanded, setTapExpanded] = useState(false);

  const collapse = useCallback(() => {
    setTapExpanded(false);
    setIsExpanded(false);
  }, []);

  // A pointer leaving the stack is what collapses it, and a finger never
  // leaves: without this the stack stays open for good once tapped, and the
  // next tap on the foot follows `onViewAll` instead of closing. The tap that
  // lands somewhere else stands in for the pointer leaving, and it is consumed
  // rather than passed through.
  useDismiss(tapExpanded && isExpanded, collapse, rootRef, {
    behavior: "consume",
  });

  const visibleItems = items.slice(0, Math.max(1, maxVisible));
  const primaryItem = visibleItems[0];
  // Only the movement's timing follows reduced motion; what renders first does not.
  const transition: Transition = reduce ? { duration: 0 } : SPRING_LAYOUT;
  const cardTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.32, ease: EASE_OUT };
  const backgroundTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.26, ease: EASE_OUT };

  if (!primaryItem) {
    return (
      // An output, whose role is status: the words that replace the stack once its last card is
      // read are announced.
      <output
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl bg-muted/70 px-5 py-8 font-medium text-foreground text-sm",
          className,
        )}
      >
        <BellOff className="size-4 text-muted-foreground" aria-hidden />
        {labels.empty}
      </output>
    );
  }

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    // Moving between the cards and the foot changes nothing.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    // Only the keyboard's focus opens the list. A browser that focuses a link
    // or a button on contact would otherwise spread the cards under the finger
    // mid-tap, and the tap would land on whatever moved there.
    if (!(event.target as Element).matches(":focus-visible")) return;
    hasFocus.current = true;
    setIsExpanded(true);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    hasFocus.current = false;
    collapse();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A key press is the start of a keyboard activation, never part of a tap:
    // whatever a taken-away gesture left behind must not be read as one.
    tap.drop();
    if (event.key !== "Escape" || !isExpanded) return;
    // The stack closes first; the panel around it closes on the next Escape.
    event.stopPropagation();
    event.preventDefault();
    // The cards the closed stack hides cannot keep the focus: it goes to the
    // foot, which opens them again.
    footRef.current?.focus();
    collapse();
  };

  const handleFootClick = () => {
    const gesture = tap.take();
    // Read from where the gesture started, not from now: a pointer that came
    // to rest on the stack has opened it already, and its click leads on.
    const wasExpanded = gesture ? gesture.state : isExpanded;

    if (!wasExpanded) {
      setIsExpanded(true);
      if (gesture && gesture.pointerType !== "mouse") setTapExpanded(true);
      return;
    }

    if (onViewAll) {
      onViewAll();
      return;
    }

    collapse();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the hover, the keyboard's focus and Escape act on the stack as a whole; the cards and the foot are its controls
    <div
      ref={rootRef}
      // A tap reports as a hover on its way past — enter, leave, then click —
      // so an unfiltered hover path expands, collapses and expands again in
      // the space of one tap. The tap has its own route through the foot.
      onPointerEnter={(event: PointerEvent<HTMLDivElement>) => {
        if (hover.enter(event)) setIsExpanded(true);
      }}
      onPointerLeave={(event: PointerEvent<HTMLDivElement>) => {
        if (hover.leave(event) && !hasFocus.current) collapse();
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn("relative z-10 block w-full text-foreground", className)}
    >
      {/* In flow, so the open list pushes down what follows the stack (the bell's panel grows with
          it) rather than rising over what comes before it. */}
      <div className="relative p-2">
        <m.span
          aria-hidden
          layout
          initial={false}
          transition={backgroundTransition}
          className="absolute inset-0 rounded-xl bg-muted"
        />
        <ol
          id={listId}
          className={cn("relative z-10 grid gap-1", !isExpanded && "pb-2")}
        >
          {visibleItems.map((item, index) => {
            // Closed, the cards behind the newest show only their edges.
            const hidden = index > 0 && !isExpanded;

            return (
              <m.li
                key={item.id}
                layout="position"
                initial={false}
                animate={{
                  y: isExpanded ? 0 : index * STACK_PEEK,
                  clipPath: isExpanded
                    ? "inset(0px 0px round 8px)"
                    : `inset(0px ${index * STACK_INSET}px round 8px)`,
                }}
                transition={cardTransition}
                aria-hidden={hidden || undefined}
                className="block rounded-lg border border-border/60 bg-background"
                style={{
                  zIndex: visibleItems.length - index,
                  gridColumn: 1,
                  gridRow: isExpanded ? index + 1 : 1,
                }}
              >
                <a
                  href={item.href}
                  onClick={(event) => onOpen?.(item, event)}
                  className={cn(
                    "block rounded-[inherit] px-3.5 text-start outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    hidden && "invisible",
                  )}
                >
                  <NotificationCardContent item={item} />
                </a>
              </m.li>
            );
          })}
        </ol>

        <m.button
          ref={footRef}
          type="button"
          layout="position"
          transition={transition}
          aria-expanded={isExpanded}
          aria-controls={listId}
          aria-label={isExpanded ? labels.open : labels.expand}
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
            tap.start(event, isExpanded);
          }}
          // The platform can take the gesture away mid-press — a scroll, a system
          // swipe — and no click follows it.
          onPointerCancel={tap.drop}
          onClick={handleFootClick}
          className="relative z-10 mt-2 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-primary px-1.5 font-medium text-primary-foreground text-xs shadow-[inset_0_1px_2px_rgb(0_0_0/0.2),inset_0_-1px_0_rgb(255_255_255/0.16)]">
            {count}
          </span>
          <span className="flex items-center gap-1 font-medium text-sm">
            <ActionSwapText value={isExpanded ? "open" : "closed"}>
              {isExpanded ? labels.viewAll : labels.collapsed}
            </ActionSwapText>
            <ArrowUpRight
              aria-hidden
              className={cn(
                "size-4 transition-opacity duration-200 rtl:-scale-x-100",
                isExpanded ? "opacity-100" : "opacity-0",
              )}
            />
          </span>
        </m.button>
      </div>
    </div>
  );
}
