import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
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
