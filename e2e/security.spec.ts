import { expect, test } from "@playwright/test";
import { securityHeaders } from "../next.config.ts";

// Every kind of response: a page, a route handler, a static script and an optimized image.
test("every response carries the security headers", async ({ request }) => {
  const page = await request.get("/");
  const script = (await page.text()).match(
    /src="(\/_next\/static\/[^"]+\.js)"/,
  )?.[1];
  expect(script).toBeDefined();

  for (const response of [
    page,
    await request.get("/healthz"),
    await request.get(script ?? ""),
    await request.get(
      "/_next/image?url=%2Fbrand%2Felement-wave.png&w=640&q=75",
    ),
  ]) {
    expect(response.status(), response.url()).toBe(200);
    for (const { key, value } of securityHeaders) {
      expect(
        response.headers()[key.toLowerCase()],
        `${key} on ${response.url()}`,
      ).toBe(value);
    }
  }
});

test("each page's scripts run under a Content Security Policy with that page's own nonce", async ({
  request,
}) => {
  const nonces = [];
  for (let load = 0; load < 2; load++) {
    const page = await request.get("/");
    const policy = page.headers()["content-security-policy"] ?? "";
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    expect(policy).toContain("frame-ancestors 'none'");
    expect(nonce).toBeDefined();
    // Next.js puts the nonce on every script it renders.
    const html = await page.text();
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
    nonces.push(nonce);
  }
  expect(nonces[0]).not.toBe(nonces[1]);
});

test("a change sent from another site, or without an origin, is refused", async ({
  request,
}) => {
  const sent: Record<string, string>[] = [
    { origin: "https://example.com" },
    {},
  ];
  for (const headers of sent) {
    const response = await request.post("/", { headers, data: "" });
    expect(response.status()).toBe(403);
  }
});
