"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { revealsSettled } from "./lib/reveals.ts";

// The animation features load after the page has painted, so Motion's engine stays off the
// critical path: m components render at once and animate when the features arrive. The pills,
// sheets and palettes here need layout animations and drag, which domMax holds.
// Their arrival changes LazyMotion's context, and React then draws again on the client any part of
// the page still streaming in from the server. A part that has arrived and waits for its reveal
// would stay in the page, hidden, beside its new copy until the reveal, so the features take effect
// once no part waits (e2e/streaming.spec.ts).
const loadFeatures = () =>
  import("./lib/features").then(async (mod) => {
    await revealsSettled();
    return mod.default;
  });

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
