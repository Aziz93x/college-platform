import { expect, it } from "vitest";
import { deviceOf } from "./device.ts";

it.each([
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    { browser: "safari", system: "iphone" },
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    { browser: "chrome", system: "windows" },
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    { browser: "edge", system: "windows" },
  ],
  [
    "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
    { browser: "samsung", system: "android" },
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0",
    { browser: "firefox", system: "macos" },
  ],
  [
    "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
    { browser: "chrome", system: "ipad" },
  ],
])("names the browser and the system of %s", (userAgent, device) => {
  expect(deviceOf(userAgent)).toEqual(device);
});

it("names nothing it does not recognize, and nothing without a user agent", () => {
  expect(deviceOf("curl/8.9.1")).toEqual({
    browser: undefined,
    system: undefined,
  });
  expect(deviceOf(null)).toEqual({});
});
