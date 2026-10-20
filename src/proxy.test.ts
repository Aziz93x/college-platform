import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { config, proxy } from "./proxy.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requestIds(incoming?: string) {
  const headers = incoming ? { "x-request-id": incoming } : undefined;
  const response = proxy(
    new NextRequest("http://localhost/readyz", { headers }),
  );
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
  afterEach(() => vi.unstubAllEnvs());

  function request(path: string, appEnv: string) {
    vi.stubEnv("APP_ENV", appEnv);
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "postgres://user:password@localhost:5432/db");
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
    return proxy(new NextRequest(`http://localhost${path}`));
  }

  // A notFound() in the route would follow a 200 status; the proxy answers 404 before rendering.
  test.each([
    ["/design", "production"],
    ["/design", "staging"],
    ["/design/anything", "production"],
  ])("answers %s on %s with the not-found page and a 404 status", (path, appEnv) => {
    const response = request(path, appEnv);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/_not-found",
    );
    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });

  test.each([
    ["/design", "local"],
    ["/designs", "production"],
    ["/", "production"],
  ])("passes %s on %s through", (path, appEnv) => {
    const response = request(path, appEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
