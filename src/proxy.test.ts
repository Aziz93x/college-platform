import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { config, proxy } from "./proxy.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function stubEnv(overrides: Record<string, string> = {}) {
  const env = {
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgres://user:password@localhost:5432/db",
    AUTH_SECRET: "unit-tests-secret-for-cookies-only",
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

beforeEach(() => stubEnv());
afterEach(() => vi.unstubAllEnvs());

// As the server receives it: with the host the browser asked for.
const request = (
  path: string,
  {
    headers,
    ...init
  }: { method?: string; headers?: Record<string, string> } = {},
) =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      ...init,
      headers: { host: "localhost:3000", ...headers },
    }),
  );

function requestIds(incoming?: string) {
  const headers = incoming ? { "x-request-id": incoming } : undefined;
  const response = request("/readyz", { headers });
  return {
    response: response.headers.get("x-request-id"),
    forwarded: response.headers.get("x-middleware-request-x-request-id"),
  };
}

describe("request id", () => {
  test("is generated when the request has none", () => {
    const ids = requestIds();
    expect(ids.response).toMatch(UUID);
    expect(ids.forwarded).toBe(ids.response);
  });

  test("replaces an id the client sent", () => {
    const ids = requestIds("edge-0123-abcd");
    expect(ids.response).not.toBe("edge-0123-abcd");
    expect(ids.response).toMatch(UUID);
    expect(ids.forwarded).toBe(ids.response);
  });
});

describe("content security policy", () => {
  const policy = (response: Response) =>
    response.headers.get("content-security-policy") ?? "";
  const nonce = (value: string) => value.match(/'nonce-([^']+)'/)?.[1];

  test("gives each page a new nonce, in the response and in the request Next.js renders", () => {
    const first = request("/");
    const second = request("/");

    expect(nonce(policy(first))).toMatch(/^[A-Za-z0-9+/]{40,}={0,2}$/);
    expect(
      first.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(policy(first));
    expect(nonce(policy(second))).not.toBe(nonce(policy(first)));
  });

  test("lets scripts run only from the platform with the nonce, and nothing frame the pages", () => {
    const directives = policy(request("/")).split("; ");
    expect(directives).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        expect.stringMatching(
          /^script-src 'self' 'nonce-[^']+' 'strict-dynamic'$/,
        ),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ]),
    );
    expect(directives).not.toContain("upgrade-insecure-requests");
  });

  test("allows eval only to React's development build", () => {
    stubEnv({ NODE_ENV: "development" });
    expect(policy(request("/"))).toContain("'unsafe-eval'");
  });

  test("upgrades requests when the platform is served over HTTPS", () => {
    stubEnv({ APP_URL: "https://college.example" });
    expect(policy(request("/")).split("; ")).toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("changes from another origin", () => {
  const post = (origin?: string) =>
    request("/", {
      method: "POST",
      headers: origin ? { origin } : undefined,
    });

  test("passes a change from the platform's own pages", () => {
    const response = post("http://localhost:3000");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  test("passes a change through a proxy that names the host it forwarded", () => {
    const response = request("/", {
      method: "POST",
      headers: {
        host: "app:3000",
        "x-forwarded-host": "college.example",
        origin: "https://college.example",
      },
    });
    expect(response.status).toBe(200);
  });

  test.each([
    ["another site", "https://evil.example"],
    ["another port", "http://localhost:4000"],
    ["no origin", undefined],
    ["an unreadable origin", "null"],
  ])("refuses a change from %s", (_case, origin) => {
    const response = post(origin);
    expect(response.status).toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });

  test("passes reads without an origin", () => {
    expect(request("/today").status).toBe(200);
  });
});

test("runs on routes but not on static files", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, url });
  expect(matches("/readyz")).toBe(true);
  expect(matches("/")).toBe(true);
  expect(matches("/_next/static/chunks/app.js")).toBe(false);
  expect(matches("/_next/image?url=x")).toBe(false);
  expect(matches("/favicon.ico")).toBe(false);
});

describe("/design", () => {
  // A notFound() in the route would follow a 200 status; the proxy answers 404 before rendering.
  test.each([
    ["/design", "production"],
    ["/design", "staging"],
    ["/design/anything", "production"],
  ])("answers %s on %s with the not-found page and a 404 status", (path, appEnv) => {
    stubEnv({ APP_ENV: appEnv });
    const response = request(path);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/_not-found",
    );
    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });

  test.each([
    ["/design", "local"],
    ["/designs", "production"],
    ["/", "production"],
  ])("passes %s on %s through", (path, appEnv) => {
    stubEnv({ APP_ENV: appEnv });
    const response = request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
