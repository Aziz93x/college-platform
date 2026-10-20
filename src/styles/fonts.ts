import localFont from "next/font/local";

// DIN Next LT Arabic: Medium for headings, Regular for body (docs/PLAN.md section 4).
// pnpm identity:sync fetches the files, which stay out of git (ADR-0004); next build reads them.
// The Arial-based fallback is metric-matched to the font, so nothing moves when it loads.
export const identityFont = localFont({
  src: [
    { path: "./fonts/din-next-lt-arabic-400.ttf", weight: "400" },
    { path: "./fonts/din-next-lt-arabic-500.ttf", weight: "500" },
  ],
  variable: "--font-identity",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Tahoma", "sans-serif"],
});
