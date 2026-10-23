// A session's device as a person's page names it: the browser and the system its user agent names,
// as keys whose words are messages (people.sessions.browsers, people.sessions.systems), or none
// for one it does not recognize (ADR-0029). Order matters: Edge, Opera and Samsung's browser also
// name Chrome and Safari, and Chrome names Safari.
const browsers = [
  ["edge", /\bEdg(?:e|A|iOS)?\//],
  ["opera", /\bOPR\//],
  ["samsung", /\bSamsungBrowser\//],
  ["firefox", /\b(?:Firefox|FxiOS)\//],
  ["chrome", /\b(?:Chrome|CriOS)\//],
  ["safari", /\bVersion\/[\d.]+.*\bSafari\//],
] as const;

const systems = [
  ["iphone", /\biPhone\b/],
  ["ipad", /\biPad\b/],
  ["android", /\bAndroid\b/],
  ["chromeos", /\bCrOS\b/],
  ["windows", /\bWindows\b/],
  ["macos", /\bMacintosh\b/],
  ["linux", /\bLinux\b/],
] as const;

export type Device = {
  browser?: (typeof browsers)[number][0];
  system?: (typeof systems)[number][0];
};

export function deviceOf(userAgent: string | null | undefined): Device {
  if (!userAgent) return {};
  return {
    browser: browsers.find(([, pattern]) => pattern.test(userAgent))?.[0],
    system: systems.find(([, pattern]) => pattern.test(userAgent))?.[0],
  };
}
