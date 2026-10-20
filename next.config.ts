import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    // forbidden() and src/app/(app)/forbidden.tsx: the page for a viewer without the permission.
    authInterrupts: true,
    // Every page reads the college's locale per request (docs/ADR/0007-locale-read-per-request.md),
    // so no navigation is instant yet: development checks only the segments that set `instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  // The identity art is line drawing on transparency, which AVIF keeps at about half WebP's size.
  images: { formats: ["image/avif", "image/webp"] },
  // Until Step 6 puts the login page at /, the address opens the shell.
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// next-intl reads the language and the messages for each request from this file.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
