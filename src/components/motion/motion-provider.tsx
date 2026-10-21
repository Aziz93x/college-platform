"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// The animation features load after the page has painted, so Motion's engine stays off the
// critical path: m components render at once and animate when the features arrive. The pills,
// sheets and palettes here need layout animations and drag, which domMax holds.
const loadFeatures = () => import("./lib/features").then((mod) => mod.default);

// Wraps every page (src/app/layout.tsx), so any m component animates. Its JavaScript animations
// follow the reduced-motion preference, which the CSS rule in src/styles/theme.css cannot reach:
// movement stops, fades stay.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
