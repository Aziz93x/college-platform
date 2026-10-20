import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import messages from "../messages/ar.json" with { type: "json" };
import { expectIdentityLoaded, identityImages } from "./identity-assets";

const design = messages.design;

const PRIMITIVES = [
  "button",
  "input",
  "textarea",
  "label",
  "form",
  "select",
  "checkbox",
  "radio-group",
  "switch",
  "dialog",
  "sheet",
  "drawer",
  "dropdown-menu",
  "popover",
  "tooltip",
  "tabs",
  "table",
  "badge",
  "avatar",
  "skeleton",
  "progress",
  "separator",
  "scroll-area",
  "command",
  "sonner",
  "calendar",
];

// Each overlay: how to reach its trigger, how it opens, and the role and name it shows.
type Overlay = {
  id: string;
  trigger: (page: Page) => Locator;
  role: Parameters<Page["getByRole"]>[0];
  name?: string;
  open?: (trigger: Locator) => Promise<void>;
};
const button = (name: string) => (page: Page) =>
  page.getByRole("button", { name });
const OVERLAYS: Overlay[] = [
  {
    id: "dialog",
    trigger: button(design.dialog.trigger),
    role: "dialog",
    name: design.dialog.title,
  },
  {
    id: "sheet",
    trigger: button(design.sheet.trigger),
    role: "dialog",
    name: design.sheet.title,
  },
  {
    id: "drawer",
    trigger: button(design.drawer.trigger),
    role: "dialog",
    name: design.drawer.title,
  },
  {
    id: "dropdown",
    trigger: button(design.dropdown.trigger),
    role: "menu",
    name: design.dropdown.trigger,
  },
  {
    id: "popover",
    trigger: button(design.popover.trigger),
    role: "dialog",
    name: design.popover.title,
  },
  {
    id: "select",
    trigger: (page) =>
      page.getByRole("combobox", { name: design.select.label }),
    role: "listbox",
  },
  {
    id: "command",
    trigger: button(design.command.trigger),
    role: "listbox",
    name: design.command.results,
  },
  { id: "calendar", trigger: button(design.calendar.trigger), role: "grid" },
  {
    id: "tooltip",
    trigger: button(design.tooltip.trigger),
    role: "tooltip",
    name: design.tooltip.content,
    open: (trigger) => trigger.focus(),
  },
];

// Behind a menu or a listbox, Radix hides the page from assistive technology and keeps focus in
// the overlay, but axe's aria-hidden-focus credits only a modal dialog with that. For these two
// the test proves instead that Tab cannot leave the overlay.
const FOCUS_KEPT = new Set(["dropdown", "select"]);

// WCAG 2.2 AA; only serious and critical violations fail. axe takes joined Arabic letters for an
// icon font's ligatures and then skips their contrast, so they become Latin letters first: same
// elements, same styles, and the contrast check runs.
async function seriousViolations(page: Page, disabledRules: string[] = []) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      node.nodeValue = (node.nodeValue ?? "").replace(
        /\p{Script=Arabic}/gu,
        "a",
      );
    }
  });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .disableRules(disabledRules)
    .analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/design");
});

test("shows every primitive", async ({ page }) => {
  const shown = await page
    .locator("[data-primitive]")
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-primitive")),
    );
  expect(shown.toSorted()).toEqual(PRIMITIVES.toSorted());
  for (const id of PRIMITIVES) {
    await expect(page.locator(`[data-primitive="${id}"]`)).toBeVisible();
  }
});

for (const { id, trigger, role, name, open } of OVERLAYS) {
  test(`${id} opens from its trigger, shows its role and closes with Escape`, async ({
    page,
  }) => {
    await (open ?? ((t) => t.click()))(trigger(page));
    const overlay = page.getByRole(role, { name });
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });
}

test("the toast shows in the notifications region", async ({ page }) => {
  await button(design.toast.trigger)(page).click();
  await expect(
    page
      .getByRole("region", { name: new RegExp(messages.toast.region) })
      .getByRole("listitem")
      .filter({ hasText: design.toast.title }),
  ).toBeVisible();
});

test("serves the identity elements from /brand/ and loads the identity font", async ({
  page,
  request,
}) => {
  const sources = await identityImages(page).evaluateAll((images) =>
    images.map((image) => image.getAttribute("src") ?? ""),
  );
  expect(sources).toHaveLength(3);
  for (const source of sources) {
    const response = await request.get(source);
    expect(response.status(), source).toBe(200);
    expect(response.headers()["content-type"], source).toBe("image/png");
  }
  await expectIdentityLoaded(page);
});

test("headings are Medium, and text uses only the two weights the identity ships", async ({
  page,
}) => {
  const weights = (selector: string) =>
    page.evaluate(
      (selector) => [
        ...new Set(
          [...document.querySelectorAll(selector)].map(
            (element) => getComputedStyle(element).fontWeight,
          ),
        ),
      ],
      selector,
    );
  expect(await weights("h1, h2, h3, h4, h5, h6")).toEqual(["500"]);
  expect((await weights("body *")).toSorted()).toEqual(["400", "500"]);
});

test.describe("axe", () => {
  // Without motion, axe measures the overlays' final colors rather than a frame of their fade.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Radix lets the scroll area scroll once it has measured its content; axe checks it then.
    await expect(page.locator('[data-slot="scroll-area-viewport"]')).toHaveCSS(
      "overflow-y",
      "scroll",
    );
  });

  test("finds no serious issue on the page", async ({ page }) => {
    expect(await seriousViolations(page)).toEqual([]);
  });

  for (const { id, trigger, role, name, open } of OVERLAYS.filter(
    (overlay) => overlay.id !== "tooltip",
  )) {
    test(`finds no serious issue with the ${id} open`, async ({ page }) => {
      await (open ?? ((t) => t.click()))(trigger(page));
      const overlay = page.getByRole(role, { name });
      await expect(overlay).toBeVisible();
      if (!FOCUS_KEPT.has(id)) {
        expect(await seriousViolations(page)).toEqual([]);
        return;
      }
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(overlay).toBeVisible();
      expect(
        await overlay.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      expect(await seriousViolations(page, ["aria-hidden-focus"])).toEqual([]);
    });
  }
});

test("motion runs on the tokens and stops when the system asks for reduced motion", async ({
  page,
}) => {
  const samples = page.locator("[data-motion]");
  const durations = () =>
    samples.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).transitionDuration),
    );
  expect(await durations()).toEqual(["0.12s", "0.16s", "0.2s"]);

  // Dialogs animate on the slow token, menus on the fast one.
  for (const [trigger, role, duration] of [
    [design.dialog.trigger, "dialog", "0.2s"],
    [design.dropdown.trigger, "menu", "0.12s"],
  ] as const) {
    await button(trigger)(page).click();
    const overlay = page.getByRole(role);
    await expect(overlay).toBeVisible();
    expect(
      await overlay.evaluate(
        (element) => getComputedStyle(element).animationDuration,
      ),
    ).toBe(duration);
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await durations()).toEqual(["0s", "0s", "0s"]);

  // The drawer's own styles set a 0.5 s transition and animation.
  await button(design.drawer.trigger)(page).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  expect(
    await drawer.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.animationDuration, style.transitionDuration];
    }),
  ).toEqual(["0s", "0s"]);
});

test("the form reads Arabic-Indic digits as Latin ones", async ({ page }) => {
  const field = page.getByRole("textbox", { name: design.form.label });
  await page.getByRole("button", { name: design.form.submit }).click();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(design.form.invalid)).toBeVisible();

  await field.fill("١٢");
  await page.getByRole("button", { name: design.form.submit }).click();
  await expect(
    page.locator('[data-primitive="form"]').getByRole("status"),
  ).toHaveText(design.form.saved.replace("{value}", "12"));
});

test("the overlays follow the document's direction and language", async ({
  page,
}) => {
  // The close buttons take their name from the catalog.
  await button(design.dialog.trigger)(page).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: messages.ui.close }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // The sheet opens at the inline end: the left edge, right to left.
  await button(design.sheet.trigger)(page).click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("button", { name: messages.ui.close }),
  ).toBeVisible();
  await expect.poll(async () => (await sheet.boundingBox())?.x).toBe(0);
  await page.keyboard.press("Escape");

  // The calendar takes both too, so the left arrow moves to the next day.
  await button(design.calendar.trigger)(page).click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toHaveAttribute("dir", "rtl");
  await expect(calendar).toHaveAttribute("lang", "ar");

  // The previous month sits at the right edge, and both month arrows point outwards: DayPicker
  // draws them for left to right, so each is turned around.
  const previous = calendar.locator(".rdp-button_previous");
  const next = calendar.locator(".rdp-button_next");
  const [previousBox, nextBox] = [
    await previous.boundingBox(),
    await next.boundingBox(),
  ];
  expect(previousBox?.x).toBeGreaterThan(nextBox?.x ?? Infinity);
  await expect(previous.locator("svg")).toHaveCSS("rotate", "180deg");
  await expect(next.locator("svg")).toHaveCSS("rotate", "180deg");

  await calendar.locator('[data-selected-single="true"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(calendar.locator("button:focus")).toHaveText("23");
});

test("a progress bar exposes its value", async ({ page }) => {
  await expect(
    page.getByRole("progressbar", {
      name: design.progress.label.replace("{value}", "40"),
    }),
  ).toHaveAttribute("aria-valuenow", "40");
});

// The controls in `scope` whose hit area is smaller than 44 by 44 px (docs/PLAN.md section 4):
// the center and the points 21 px above, below and to either side of it (1 px inside the edge, for
// subpixel layout) must reach the control, something inside it, or its label, and not a
// neighbour's hit area. Disabled controls are left out.
function smallTargets(scope: Locator) {
  return scope.evaluate((root) => {
    const half = 44 / 2 - 1;
    const points = [
      [0, 0],
      [-half, 0],
      [half, 0],
      [0, -half],
      [0, half],
    ];
    const controls = root.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="switch"]',
        '[role="tab"]',
        '[role="combobox"]',
        '[role="menuitem"]',
        '[role="menuitemcheckbox"]',
        '[role="option"]',
      ].join(", "),
    );
    const small: string[] = [];
    for (const control of controls) {
      if (
        control.matches(":disabled, [aria-disabled='true'], [data-disabled]") ||
        control.closest("[aria-hidden='true'], .sr-only") ||
        control.getClientRects().length === 0
      ) {
        continue;
      }
      control.scrollIntoView({ block: "center", inline: "center" });
      const box = control.getBoundingClientRect();
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      const labels = [...((control as HTMLInputElement).labels ?? [])];
      const reaches = (hit: Element | null) =>
        hit !== null &&
        (control.contains(hit) || labels.some((label) => label.contains(hit)));
      const covered = points.every(([dx, dy]) =>
        reaches(document.elementFromPoint(x + dx, y + dy)),
      );
      if (!covered) {
        const name =
          control.getAttribute("aria-label") ??
          (labels[0] ?? control).textContent?.trim();
        small.push(`${control.tagName.toLowerCase()} "${name}"`);
      }
    }
    return small;
  });
}

// Where an overlay's controls are, when its role above names only part of it.
const TOUCH_SCOPES: Record<string, (page: Page) => Locator> = {
  calendar: (page) => page.locator('[data-slot="calendar"]'),
  command: (page) => page.getByRole("dialog", { name: design.command.title }),
};

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");
  // Without motion, a sheet is measured where it stops, not while it slides in.
  test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

  test("every enabled control on the page has a 44 px hit area", async ({
    page,
  }) => {
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  for (const { id, trigger, role, name } of OVERLAYS.filter(
    (overlay) => overlay.id !== "tooltip",
  )) {
    test(`every enabled control in the ${id} has a 44 px hit area`, async ({
      page,
    }) => {
      await trigger(page).click();
      const overlay = page.getByRole(role, { name });
      await expect(overlay).toBeVisible();
      expect(await smallTargets(TOUCH_SCOPES[id]?.(page) ?? overlay)).toEqual(
        [],
      );
    });
  }
});
