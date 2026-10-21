"use client";

import { MoreHorizontal, X } from "lucide-react";
import {
  AnimatePresence,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import * as m from "motion/react-m";
import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT } from "./lib/ease";
import { useHoverCapable } from "./lib/use-hover-capable";

export type OverflowActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
};

interface OverflowActionsProps {
  actions: OverflowActionItem[];
  /** The toggle's name while the actions are hidden, and while they show. */
  openLabel: string;
  closeLabel: string;
}

// This needs a softer layout spring than the app defaults so the overflow group
// stays visually attached to the toggle while entering and leaving.
const SHELL_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 17,
  mass: 0.85,
};

const ICON_VARIANTS: Variants = {
  hidden: { opacity: 0, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    filter: "blur(3px)",
    transition: { duration: 0.18, ease: EASE_OUT },
  },
};

const OVERFLOW_ACTION_VARIANTS: Variants = {
  hidden: { opacity: 0, filter: "blur(4px)" },
  visible: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(4px)" },
};

export function OverflowActions({
  actions,
  openLabel,
  closeLabel,
}: OverflowActionsProps) {
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const overflowId = useId();
  const overflowWrapperRef = useRef<HTMLDivElement>(null);
  const overflowWrapperLeftRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const transition = reduce ? { duration: 0 } : SHELL_TRANSITION;

  useLayoutEffect(() => {
    const overflowNode = overflowWrapperRef.current;
    if (!overflowNode) return;

    if (!isExpanded) {
      overflowNode.style.left = `${
        overflowWrapperLeftRef.current -
        overflowNode.getBoundingClientRect().left
      }px`;
      return;
    }

    overflowNode.style.left = "";
    overflowWrapperLeftRef.current = overflowNode.getBoundingClientRect().left;
  }, [isExpanded]);

  const handleAction = (item: OverflowActionItem) => {
    item.onClick();
    setIsExpanded(false);
  };

  return (
    <m.div layout transition={transition} className="inline-flex">
      <m.div
        layout
        transition={transition}
        className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-border bg-card p-1.5 text-sm"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {isExpanded ? (
            <m.div
              key="overflow-actions"
              ref={overflowWrapperRef}
              id={overflowId}
              layout
              aria-hidden={!isExpanded}
              transition={transition}
              className="relative inline-flex w-max items-center gap-1.5"
            >
              {actions.map((item) => (
                <ActionButton
                  key={item.id}
                  item={item}
                  reduce={reduce}
                  canHover={canHover}
                  visible={isExpanded}
                  onAction={handleAction}
                  layoutTransition={transition}
                />
              ))}
            </m.div>
          ) : null}
        </AnimatePresence>

        <m.button
          type="button"
          layout
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? overflowId : undefined}
          aria-label={isExpanded ? closeLabel : openLabel}
          title={isExpanded ? closeLabel : openLabel}
          onClick={() => setIsExpanded(!isExpanded)}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          whileHover={reduce || !canHover ? undefined : { scale: 1.03 }}
          transition={transition}
          className={cn(
            "relative inline-grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={isExpanded ? "close" : "open"}
              variants={ICON_VARIANTS}
              initial={reduce ? { opacity: 0 } : "hidden"}
              animate={reduce ? { opacity: 1 } : "visible"}
              exit={reduce ? { opacity: 0 } : "exit"}
              className="inline-grid place-items-center"
            >
              {isExpanded ? (
                <X aria-hidden className="size-4" />
              ) : (
                <MoreHorizontal aria-hidden className="size-4" />
              )}
            </m.span>
          </AnimatePresence>
        </m.button>
      </m.div>
    </m.div>
  );
}

function ActionButton({
  item,
  reduce,
  canHover,
  visible,
  onAction,
  layoutTransition,
}: {
  item: OverflowActionItem;
  reduce: boolean | null;
  canHover: boolean;
  visible: boolean;
  onAction: (item: OverflowActionItem) => void;
  layoutTransition: Transition;
}) {
  return (
    <m.span
      layout="position"
      variants={OVERFLOW_ACTION_VARIANTS}
      initial={reduce ? { opacity: 0 } : "hidden"}
      animate={reduce ? { opacity: 1 } : "visible"}
      exit={reduce ? { opacity: 0 } : "exit"}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      whileHover={reduce || !canHover ? undefined : { scale: 1.008 }}
      transition={layoutTransition}
      className="inline-flex shrink-0"
    >
      <button
        type="button"
        tabIndex={visible ? undefined : -1}
        onClick={() => onAction(item)}
        className={cn(
          "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-3.5 font-medium text-foreground outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {item.icon ? (
          <span
            aria-hidden
            className="inline-flex size-4 shrink-0 items-center justify-center"
          >
            {item.icon}
          </span>
        ) : null}
        <span className="whitespace-nowrap">{item.label}</span>
      </button>
    </m.span>
  );
}
