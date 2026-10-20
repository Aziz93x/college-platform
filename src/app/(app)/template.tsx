"use client";

import * as m from "motion/react-m";
import { type ReactNode, useEffect, useState } from "react";
import { SPRING_PANEL } from "@/components/motion/lib/ease";

// Set after the first page has shown. The page a person lands on appears at once, with the server's
// HTML, so its largest paint never waits for JavaScript; each page opened after it rises into place.
let landed = false;

export default function Template({ children }: { children: ReactNode }) {
  const [initial] = useState(() =>
    landed ? { opacity: 0, y: 8 } : (false as const),
  );
  useEffect(() => {
    landed = true;
  }, []);
  return (
    <m.div
      initial={initial}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_PANEL}
    >
      {children}
    </m.div>
  );
}
