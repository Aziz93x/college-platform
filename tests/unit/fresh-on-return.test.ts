import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// FreshOnReturn's own rule (lead review D), with the browser's history and React's effects played by
// hand, as the unit project has no browser: a page shows when its effect runs and hides when its
// cleanup runs, as React's <Activity> does for the pages Next.js keeps. The Navigation API gives
// each entry of the history a key, which a replace of its state, as the router makes after every
// step, keeps.
const refresh = vi.fn();
const effects: (() => undefined | (() => void))[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("react", () => ({
  useEffect: (effect: () => undefined | (() => void)) => {
    effects.push(effect);
  },
}));

type Entry = { key: string; href: string };
const navigation = Object.assign(new EventTarget(), {
  currentEntry: null as Entry | null,
});
const browser = Object.assign(new EventTarget(), {
  navigation,
  location: { href: "" },
});
let FreshOnReturn: () => null;
let keys = 0;

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = browser;
  ({ FreshOnReturn } = await import("@/components/fresh-on-return"));
});
beforeEach(() => refresh.mockClear());

const moved = (to: Entry, navigationType: string) => {
  navigation.currentEntry = to;
  browser.location.href = to.href;
  navigation.dispatchEvent(
    Object.assign(new Event("currententrychange"), { navigationType }),
  );
  return to;
};
// A link to a page: a new entry of the history.
const link = (path: string) => {
  keys += 1;
  return moved(
    { key: `entry-${keys}`, href: `https://college.example${path}` },
    "push",
  );
};
// A step back or forward to an entry, then the router's replace of its state.
const step = (to: Entry) => {
  moved(to, "traverse");
  moved(to, "replace");
};
// The page of the current entry shown: its effect runs; gives what hides it.
function show() {
  FreshOnReturn();
  const effect = effects.pop();
  if (!effect) throw new Error("no effect");
  return effect() ?? (() => {});
}

describe("a page that reads itself again on a step back to it", () => {
  it("reads itself again once for a step back to it, and not for a link to it", () => {
    const board = link("/readiness");
    show()();
    expect(refresh).not.toHaveBeenCalled();
    link("/today");
    step(board);
    show()();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("is not read again for a step back it never showed for, when a link opens it later", () => {
    const board = link("/readiness");
    show()();
    link("/today");
    // The step reaches the board, which does not show before the viewer moves on.
    step(board);
    link("/requests");
    link("/readiness");
    show()();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reads itself again when the browser brings the whole page back from its own cache", () => {
    link("/console");
    const hide = show();
    browser.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: false }),
    );
    expect(refresh).not.toHaveBeenCalled();
    browser.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: true }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    hide();
  });
});
