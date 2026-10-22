import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import lock from "../../scripts/identity/identity.lock.json" with {
  type: "json",
};
import {
  type DigitalTokens,
  renderTokenNames,
  renderTokens,
} from "../../scripts/identity/render-tokens.ts";
import { paletteTokens, roleTokens } from "../../src/styles/token-names.ts";

const repo = join(import.meta.dirname, "../..");
const css = readFileSync(join(repo, "src/styles/tokens.css"), "utf8");
const { hues, light, extra } = lock.tokens;

// The custom properties of one rule in tokens.css, in order.
function declarations(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return new Map(
    [...body.matchAll(/(--[\w*-]+): ([^;]+);/g)].map(([, name, value]) => [
      name,
      value,
    ]),
  );
}
const root = declarations(":root");
const dark = declarations(".dark");
const roles = [...Object.keys(light), ...Object.keys(extra)];

const palette = [...root].filter(([name]) => name.startsWith("--palette-"));

// The digital tokens rebuilt from the committed palette: rendering them must give the file back.
function rebuiltSource(): DigitalTokens {
  const tokens = palette.map(([name, hex]) => {
    const [, hue, step] = /^--palette-(\w+)-(\d)$/.exec(name) ?? [];
    const column = hues.indexOf(hue) + 1;
    return [
      `support-r${step}-c${column}`,
      { row_from_top: Number(step), column_from_left: column, hex },
    ] as const;
  });
  return { tokens: Object.fromEntries(tokens) };
}

function hexOf(theme: "light" | "dark", role: string) {
  const value =
    (theme === "dark" ? dark.get(`--${role}`) : undefined) ??
    root.get(`--${role}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value ?? "")?.[1];
  return reference ? root.get(reference) : value;
}

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// [text, surface] pairs that carry text: 4.5:1 (WCAG 1.4.3). Teal (secondary) and green (accent)
// never carry text.
const sharedText = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "popover"],
  ["foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "popover"],
  ["primary", "background"],
  ["primary-foreground", "primary"],
];
const textPairs = {
  light: [
    ...sharedText,
    ["alert", "background"],
    ["alert", "card"],
    ["alert-foreground", "alert"],
  ],
  // The one red the owner allowed cannot reach 4.5:1 on a dark surface, so in the dark theme the
  // alert is only a filled surface under alert-foreground text. Error text and borders in --alert
  // fail there: the dark theme waits for the owner's answer (docs/PLAN.md, Step 23 notes).
  dark: [...sharedText, ["alert-foreground", "alert"]],
};
// Tinted grounds that carry text, as Tailwind paints `bg-primary/5`: the role mixed at its share
// over the card. Muted text stays off them: on an unread notification's tint it measured 4.18:1
// (Audit 4), and on a term's weeks 4.18:1 and 3.97:1 (Audit 5), so tinted rows and their hover use
// the foreground.
const tints: Record<string, [role: string, share: number]> = {
  // An unread notification, the pilot banner and an info alert.
  "primary/5": ["primary", 0.05],
  // A row under the pointer.
  "muted/60": ["muted", 0.6],
  // A week of holidays in a term's weeks.
  "muted/40": ["muted", 0.4],
  // An error alert.
  "alert/5": ["alert", 0.05],
};
const tintedText = [
  ["foreground", "primary/5"],
  ["primary", "primary/5"],
  ["foreground", "muted/60"],
  ["foreground", "muted/40"],
  ["alert", "alert/5"],
];
function tinted(ground: string) {
  const [role, share] = tints[ground];
  const [over, under] = [hexOf("light", role), hexOf("light", "card")];
  const channel = (hex: string, at: number) =>
    Number.parseInt(hex.slice(at, at + 2), 16);
  return `#${[1, 3, 5]
    .map((at) =>
      Math.round(
        share * channel(over ?? "", at) +
          (1 - share) * channel(under ?? "", at),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// UI parts and graphics against their surface: 3:1 (WCAG 1.4.11). Border (the identity's light
// rule) and secondary are decoration, so they are not here.
const sharedUi = [
  ...["primary", "accent", "input", "ring"].flatMap((part) => [
    [part, "background"],
    [part, "card"],
  ]),
  ...[1, 2, 3, 4, 5].map((n) => [`chart-${n}`, "background"]),
];
const uiPairs = {
  light: [...sharedUi, ["alert", "background"]],
  dark: sharedUi,
};

const cases = (pairs: Record<"light" | "dark", string[][]>) =>
  (["light", "dark"] as const).flatMap((theme) =>
    pairs[theme].map(([fore, back]) => [theme, fore, back] as const),
  );

describe("src/styles/tokens.css", () => {
  it("defines every swatch of the identity palette", () => {
    expect(palette.map(([name]) => name)).toEqual(
      hues.flatMap((hue) =>
        [1, 2, 3, 4, 5, 6].map((step) => `--palette-${hue}-${step}`),
      ),
    );
    expect(palette).toHaveLength(36);
  });

  it("clears Tailwind's colors and exposes only the semantic roles", () => {
    expect([...declarations("@theme inline")]).toEqual([
      ["--color-*", "initial"],
      ...roles.map((role) => [`--color-${role}`, `var(--${role})`]),
    ]);
  });

  it("defines every role in both themes, dark only under .dark", () => {
    expect(roles.every((role) => root.has(`--${role}`))).toBe(true);
    expect([...dark.keys()]).toEqual(
      Object.keys(light).map((role) => `--${role}`),
    );
    expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *));");
    expect(css).not.toContain("@media");
    expect(css).not.toContain("prefers-color-scheme");
  });

  it.each(
    cases(textPairs),
  )("%s: %s on %s reaches 4.5:1", (theme, fore, back) => {
    expect(
      contrast(hexOf(theme, fore) ?? "", hexOf(theme, back) ?? ""),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(
    tintedText,
  )("light: %s on the %s tint reaches 4.5:1", (fore, ground) => {
    expect(
      contrast(hexOf("light", fore) ?? "", tinted(ground)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases(uiPairs))("%s: %s on %s reaches 3:1", (theme, fore, back) => {
    expect(
      contrast(hexOf(theme, fore) ?? "", hexOf(theme, back) ?? ""),
    ).toBeGreaterThanOrEqual(3);
  });

  it("is what the renderer makes from the palette, whatever the source order", () => {
    const source = rebuiltSource();
    const reversed = {
      tokens: Object.fromEntries(Object.entries(source.tokens).reverse()),
    };
    expect(renderTokens(source, lock)).toBe(css);
    expect(renderTokens(reversed, lock)).toBe(css);
  });

  it("lists every custom property for token-names.ts, as the renderer makes it", () => {
    expect(paletteTokens).toEqual(palette.map(([name]) => name));
    expect(roleTokens).toEqual(roles.map((role) => `--${role}`));
    expect(renderTokenNames(rebuiltSource(), lock)).toBe(
      readFileSync(join(repo, "src/styles/token-names.ts"), "utf8"),
    );
  });

  it("names the identity repo and commit it was generated from", () => {
    expect(css).toContain(`${lock.repo} at commit ${lock.commit}`);
  });

  it("covers every custom property that theme.css reads", () => {
    const theme = readFileSync(join(repo, "src/styles/theme.css"), "utf8");
    const used = [...theme.matchAll(/var\((--[\w-]+)\)/g)].map(([, n]) => n);
    // --font-identity comes from next/font (src/styles/fonts.ts).
    expect(
      used.filter((name) => name !== "--font-identity" && !root.has(name)),
    ).toEqual([]);
  });
});
