import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { MAX_UPLOAD_BYTES } from "./src/platform/files/upload-limit.ts";

// Sent with every response, static files included. The Content Security Policy, which needs a new
// nonce for each page, comes from src/proxy.ts.
export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

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
    // A people file or a Rayat report arrives in a server action's body (Steps 10 and 16).
    serverActions: { bodySizeLimit: MAX_UPLOAD_BYTES },
  },
  // The identity art is line drawing on transparency, which AVIF keeps at about half WebP's size.
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
