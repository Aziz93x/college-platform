import localFont from "next/font/local";

// DIN Next LT Arabic: Medium for headings, Regular for body (docs/PLAN.md section 4).
// pnpm identity:sync fetches the files, which stay out of git (ADR-0004); next build reads them.
// The Arial-based fallback is metric-matched to the font, so nothing moves when it loads.
// Not preloaded: the two files are 155 kB, and on a slow phone a preload holds the page's first
// text back until both arrive (Lighthouse LCP about 2.6 s with it, 1.7 to 2.1 s without). The
// text shows in the fallback first and swaps without moving.
export const identityFont = localFont({
  src: [
    { path: "./fonts/din-next-lt-arabic-400.ttf", weight: "400" },
    { path: "./fonts/din-next-lt-arabic-500.ttf", weight: "500" },
  ],
  variable: "--font-identity",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  fallback: ["Tahoma", "sans-serif"],
});
