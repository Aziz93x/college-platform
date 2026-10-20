import { describe, expect, it } from "vitest";
import {
  SCREEN_WIDTHS,
  screenPath,
  screenProjects,
  screensOptions,
} from "../../e2e/screens/options.ts";

describe("screensOptions", () => {
  it("captures / for anonymous into .local/screens by default", () => {
    expect(screensOptions({})).toEqual({
      routes: ["/"],
      roles: ["anonymous"],
      out: ".local/screens",
    });
    expect(
      screensOptions({
        SCREENS_ROUTES: " ",
        SCREENS_OUT: "",
        SCREENS_ROLES: "",
      }),
    ).toEqual(screensOptions({}));
  });

  it("reads routes separated by spaces or commas, once each", () => {
    const { routes } = screensOptions({
      SCREENS_ROUTES: "/design, /\n/design,/a/b",
    });
    expect(routes).toEqual(["/design", "/", "/a/b"]);
  });

  it("takes the output folder and roles from the environment", () => {
    const options = screensOptions({
      SCREENS_OUT: "docs/reviews/ux-10",
      SCREENS_ROLES: "anonymous",
    });
    expect(options.out).toBe("docs/reviews/ux-10");
    expect(options.roles).toEqual(["anonymous"]);
  });

  it("refuses two routes that would be saved under the same file name", () => {
    expect(() => screensOptions({ SCREENS_ROUTES: "/a-b /a/b" })).toThrow(
      '"/a-b" and "/a/b"',
    );
    expect(() => screensOptions({ SCREENS_ROUTES: "/x?y=1,/x/y/1" })).toThrow(
      '"/x?y=1" and "/x/y/1"',
    );
  });

  it("refuses a route without a leading slash and a role it cannot sign in as", () => {
    expect(() => screensOptions({ SCREENS_ROUTES: "/ design" })).toThrow(
      '"design"',
    );
    expect(() => screensOptions({ SCREENS_ROLES: "anonymous,x" })).toThrow(
      '"x"',
    );
  });
});

describe("screenPath", () => {
  it("names each file <out>/<role>/<route-slug>-<width>.png", () => {
    expect(SCREEN_WIDTHS).toEqual([390, 768, 1440]);
    expect(
      SCREEN_WIDTHS.map((width) =>
        screenPath(".local/screens", "anonymous", "/design", width),
      ),
    ).toEqual([
      ".local/screens/anonymous/design-390.png",
      ".local/screens/anonymous/design-768.png",
      ".local/screens/anonymous/design-1440.png",
    ]);
  });

  it('calls "/" index and turns other characters into single dashes', () => {
    expect(screenPath("out", "anonymous", "/", 390)).toBe(
      "out/anonymous/index-390.png",
    );
    expect(screenPath("out", "anonymous", "/a/b/?c=d", 768)).toBe(
      "out/anonymous/a-b-c-d-768.png",
    );
  });
});

describe("screenProjects", () => {
  it("captures each width in its own project, the phone width as a touch phone", () => {
    expect(
      screenProjects.map(({ name, use }) => [
        name,
        use.viewport.width,
        use.isMobile,
        use.hasTouch,
        "browserName" in use ? use.browserName : use.defaultBrowserType,
      ]),
    ).toEqual([
      ["390", 390, true, true, "chromium"],
      ["768", 768, false, false, "chromium"],
      ["1440", 1440, false, false, "chromium"],
    ]);
  });
});
