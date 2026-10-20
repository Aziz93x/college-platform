import { expect, type Page, test } from "@playwright/test";

// Every Arabic letter (a pangram), the hamza forms, taa marbuta, alif maqsura, lam-alif, Arabic
// punctuation and the Latin digits the platform shows.
const SPECIMEN =
  "نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومغلف بجلد أزرق، إلى آفاق رؤية جديدة؛ هل تقرأ قائمة المهام؟ لا شيء 0123456789";
// Joined, its letters take their initial, medial and final forms; U+200C keeps each one apart.
const WORD = "مكتوب";

// Adds a paragraph in the page's own styles to the end of <body>, where React's hydration leaves
// it in place, and returns its selector.
async function addParagraph(page: Page, text: string, weight: string) {
  const id = `specimen-${weight}`;
  await page.evaluate(
    ({ id, text, weight }) => {
      const paragraph = document.createElement("p");
      paragraph.id = id;
      paragraph.style.fontWeight = weight;
      paragraph.textContent = text;
      document.body.append(paragraph);
    },
    { id, text, weight },
  );
  return `#${id}`;
}

test("Arabic text renders and joins in the identity font, in Regular and Medium", async ({
  page,
}) => {
  await page.goto("/design");
  const selectors = [
    await addParagraph(page, SPECIMEN, "400"),
    await addParagraph(page, SPECIMEN, "500"),
  ];
  await page.evaluate(() => document.fonts.ready);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const faces: string[] = [];
  for (const selector of selectors) {
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    // One font for the whole paragraph: no glyph falls back to a system font.
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    expect(fonts).toEqual([
      expect.objectContaining({
        familyName: "DIN Next LT Arabic",
        isCustomFont: true,
      }),
    ]);
    faces.push(fonts[0]?.postScriptName ?? "");
  }
  // Medium is its own file, not Regular made bolder.
  expect(new Set(faces).size).toBe(2);

  // Shaping: the joined word is not as wide as its letters set apart.
  const width = (text: string) =>
    page.evaluate((text) => {
      // Inline in a paragraph, so the span is as wide as its text.
      const paragraph = document.createElement("p");
      const span = document.createElement("span");
      span.textContent = text;
      paragraph.append(span);
      document.body.append(paragraph);
      return span.getBoundingClientRect().width;
    }, text);
  const joined = await width(WORD);
  expect(joined).toBeGreaterThan(0);
  expect(joined).not.toBe(await width([...WORD].join("\u200C")));
});

declare global {
  interface Window {
    fontSwap: {
      layoutShift: number;
      fontAtFirstFrame?: boolean;
      identityFontLoaded: () => boolean;
    };
  }
}

// Loads the page with the font files a second late, so the metric-matched fallback paints first,
// and reports what the first frame and the settled page used and how far the layout shifted.
async function loadWithLateFont(page: Page, path: string) {
  await page.route("**/_next/static/media/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.continue();
  });
  await page.addInitScript(() => {
    const swap: Window["fontSwap"] = {
      layoutShift: 0,
      // next/font names the face; --font-identity lists it first, then the fallback.
      identityFontLoaded: () =>
        document.fonts.check(
          `1em ${getComputedStyle(document.documentElement).getPropertyValue("--font-identity").split(",")[0]}`,
        ),
    };
    window.fontSwap = swap;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) swap.layoutShift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    addEventListener("DOMContentLoaded", () =>
      requestAnimationFrame(() => {
        swap.fontAtFirstFrame = swap.identityFontLoaded();
      }),
    );
  });

  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  // Two frames later, so the shift the swap causes is recorded.
  return page.evaluate(
    () =>
      new Promise<{
        fontAtFirstFrame?: boolean;
        fontAtEnd: boolean;
        layoutShift: number;
      }>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve({
              fontAtFirstFrame: window.fontSwap.fontAtFirstFrame,
              fontAtEnd: window.fontSwap.identityFontLoaded(),
              layoutShift: window.fontSwap.layoutShift,
            }),
          ),
        ),
      ),
  );
}

test("on /design the identity font replaces the fallback without a layout shift", async ({
  page,
}) => {
  const { fontAtFirstFrame, fontAtEnd, layoutShift } = await loadWithLateFont(
    page,
    "/design",
  );
  expect(fontAtFirstFrame).toBe(false);
  expect(fontAtEnd).toBe(true);
  expect(layoutShift).toBeLessThan(0.05);
});

// The home page has no text until the login page arrives, so only the shift is measured there.
test("on / the page does not shift while the identity font loads", async ({
  page,
}) => {
  const { layoutShift } = await loadWithLateFont(page, "/");
  expect(layoutShift).toBeLessThan(0.05);
});
