"use client";

import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { SPRING_GLIDE } from "./lib/ease.ts";
import { type SliderOptions, useSlider } from "./lib/use-slider.ts";

// Bouncy grab feedback for the thumb's scale only.
const SPRING_BOUNCY = {
  type: "spring",
  stiffness: 500,
  damping: 14,
  mass: 0.7,
} as const;

export interface RangeSliderProps extends SliderOptions {
  /** A tick dot at each step, when there are 50 steps or fewer. */
  showTicks?: boolean;
  className?: string;
}

// A track with a vertical-bar handle that bounces as it is grabbed, and tick dots at each step.
// Right to left, the drawing is mirrored, so the lowest value sits at the inline start.
export function RangeSlider({
  showTicks = true,
  className,
  ...options
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  const { percent, dragging, min, max, step, trackProps, sliderProps } =
    useSlider(options);
  const [trackWidth, setTrackWidth] = useState(292);
  useLayoutEffect(() => {
    const track = trackProps.ref.current;
    if (!track) return;
    const measure = () => {
      const width = track.getBoundingClientRect().width;
      if (width > 0) setTrackWidth(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [trackProps.ref]);

  // A spring-smoothed position drives both the thumb and the fill.
  const target = useMotionValue(percent);
  useEffect(() => {
    target.set(percent);
  }, [percent, target]);
  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const thumbX = useTransform(
    pos,
    (p) => 8 + (Math.max(0, trackWidth - 20) * p) / 100,
  );
  // The 4 px handle starts 8 px inside the track, and the rounded fill extends 8 px past it.
  // A full-size fill moves inside the 2 px inset clip, so its corner never stretches.
  const fillX = useTransform(pos, (p) =>
    p >= 100 ? "0%" : `calc(${p - 100}% + ${14 - 0.16 * p}px)`,
  );

  // Floor rather than round, so a range the step does not divide stops its dots at the last
  // whole step instead of drawing one past max.
  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) =>
          Number((min + i * step).toFixed(6)),
        )
      : [];

  return (
    <div
      {...trackProps}
      className={cn(
        // The border is drawn over the track, so the handle's 44 px hit area is not clipped by it.
        "relative flex h-11 w-full touch-none select-none items-center overflow-hidden rounded-lg bg-muted [-webkit-touch-callout:none] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-input",
        options.disabled
          ? "pointer-events-none opacity-50"
          : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div className="absolute inset-0 rtl:-scale-x-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg"
        >
          <m.div
            className="absolute inset-0 rounded-lg bg-primary/20"
            style={{ x: fillX }}
          />
        </div>
        {/* Tick centres follow the same inset path as the handle's centre. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[10px] inset-y-0"
        >
          {ticks.map((t) => {
            const tp = ((t - min) / (max - min)) * 100;
            return (
              <span
                key={t}
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25"
                style={{ left: `${tp}%` }}
              />
            );
          })}
        </div>
        <m.div
          {...sliderProps}
          // Always set, so the server and a client that prefers reduced motion draw it alike.
          animate={{ scaleY: dragging && !reduce ? 1.35 : 1 }}
          transition={SPRING_BOUNCY}
          // A 4 px bar with a 44 px hit area; the whole track takes a drag too.
          className="absolute top-1/2 left-0 h-6 w-1 rounded-full bg-primary outline-none ring-ring/40 ring-inset after:absolute after:-inset-x-5 after:-inset-y-2.5 after:content-[''] focus-visible:ring-4"
          style={{ x: thumbX, y: "-50%" }}
        />
      </div>
    </div>
  );
}
