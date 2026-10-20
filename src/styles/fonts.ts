import localFont from "next/font/local";

// DIN Next LT Arabic: Medium for headings, Regular for body (docs/PLAN.md section 4).
// pnpm identity:sync fetches the files, which stay out of git (ADR-0004); next build reads them.
// The Arial-based fallback is metric-matched to the font, so nothing moves when it loads.
// Not preloaded: the two files are 155 kB, and on a slow phone a preload shares the connection with
// the stylesheet, so the first text shows later (Lighthouse with slow 4G applied: 1.7 s with it,
// 1.5 to 1.6 s without); the font itself arrives about 0.6 s later without it. The text shows in
// the fallback first and swaps without moving.
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
