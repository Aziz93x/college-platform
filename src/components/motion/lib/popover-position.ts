"use client";

import { type RefObject, useCallback, useLayoutEffect, useState } from "react";

export type PortalLayout = {
  trigger: { left: number; top: number; width: number; height: number };
  content: { width: number; height: number };
};

function sameLayout(a: PortalLayout | null, b: PortalLayout) {
  return (
    a?.trigger.left === b.trigger.left &&
    a.trigger.top === b.trigger.top &&
    a.trigger.width === b.trigger.width &&
    a.trigger.height === b.trigger.height &&
    a.content.width === b.content.width &&
    a.content.height === b.content.height
  );
}

/** Measures a trigger and the panel portalled from it, in viewport coordinates. */
export function usePopoverPortalPosition(
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const [layout, setLayout] = useState<PortalLayout | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;
    const rect = trigger.getBoundingClientRect();
    const next: PortalLayout = {
      trigger: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      content: { width: content.offsetWidth, height: content.offsetHeight },
    };
    setLayout((current) => (sameLayout(current, next) ? current : next));
  }, [contentRef, triggerRef]);

  useLayoutEffect(() => {
    update();
    if (!active) return;
    const observer = new ResizeObserver(update);
    if (triggerRef.current) observer.observe(triggerRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, contentRef, triggerRef, update]);

  return layout;
}
