import type { Locator, Page } from "@playwright/test";
import messages from "../messages/ar.json" with { type: "json" };
import { expectIdentityLoaded, identityImages } from "./identity-assets";
import { settled } from "./screens/settled";
import { STORAGE } from "./support/auth.ts";
import { seriousViolations } from "./support/axe.ts";
import { valueOnTop } from "./support/stepper.ts";
import { expect, test } from "./support/test.ts";
import { smallTargets } from "./support/touch.ts";

// The catalog is open to whoever holds design.view: the demo admin (e2e/auth.setup.ts).
test.use({ storageState: STORAGE.admin });

const design = messages.design;

// What the screens use, then the primitives no BeUI component replaces (UX review 1, C7).
const PRIMITIVES = [
  "input",
  "checkbox",
  "switch",
  "select",
  "combobox",
  "multi-select",
  "stepper",
  "slider",
  "tabs",
  "table",
  "badge",
  "action-swap",
  "overflow-actions",
  "alert",
  "save-actions",
  "search",
  "bottom-sheet",
  "command-palette",
  "date-range",
  "dialog",
  "tooltip",
  "sonner",
  "button",
  "textarea",
  "label",
  "form",
  "radio-group",
  "avatar",
  "skeleton",
  "progress",
  "separator",
  "scroll-area",
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
// A trigger whose name carries the label, then what is chosen.
const labelled = (label: string) => (page: Page) =>
  page.getByRole("button", { name: new RegExp(`^${label}`) }).first();
const OVERLAYS: Overlay[] = [
  {
    id: "dialog",
    trigger: button(design.dialog.trigger),
    role: "dialog",
    name: design.dialog.title,
  },
  {
    id: "select",
    trigger: labelled(design.select.label),
    role: "listbox",
  },
  {
    id: "combobox",
    trigger: (page) =>
      page.getByRole("combobox", { name: design.combobox.label }),
    role: "listbox",
    name: design.combobox.list,
  },
  {
    id: "multi-select",
    trigger: (page) =>
      page.getByRole("combobox", { name: design.multiSelect.label }),
    role: "listbox",
    name: design.multiSelect.list,
  },
  { id: "date-range", trigger: labelled(design.period.label), role: "grid" },
  {
    id: "bottom-sheet",
    trigger: button(design.bottomSheet.trigger),
    role: "dialog",
    name: design.bottomSheet.title,
  },
  {
    id: "command-palette",
    trigger: button(design.commandPalette.trigger),
    role: "dialog",
    name: design.commandPalette.dialog,
  },
  {
    id: "tooltip",
    trigger: button(design.tooltip.trigger),
    role: "tooltip",
    name: design.tooltip.content,
    open: (trigger) => trigger.focus(),
  },
];

// The catalog, not loading.tsx's skeleton, which stays in its place until after the load event.
test.beforeEach(async ({ page }) => {
  await page.goto("/design");
  await settled(page);
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

// A transform moves a field without a scroll or a resize, as a sheet sliding in moves its first
// field, which opens its list as the sheet takes focus (UX review 2: the transfer sheet's list once
// stayed where the field had been, over it).
test("the combobox's list follows its field when the field moves", async ({
  page,
}) => {
  const field = page.getByRole("combobox", { name: design.combobox.label });
  await field.click();
  const list = page.getByRole("listbox", { name: design.combobox.list });
  await expect(list).toBeVisible();
  await field.evaluate((node) => {
    const sample = node.closest<HTMLElement>("[data-primitive]");
    if (sample) sample.style.transform = "translateY(-160px)";
  });
  // The gap between the field and its list, whether the list opened below it or above it.
  await expect
    .poll(async () => {
      const [box, panel] = await Promise.all([
        field.boundingBox(),
        list.boundingBox(),
      ]);
      if (!box || !panel) return Number.POSITIVE_INFINITY;
      return Math.min(
        Math.abs(panel.y - (box.y + box.height)),
        Math.abs(box.y - (panel.y + panel.height)),
      );
    })
    .toBeLessThan(24);
});

// The catalog starts with two people chosen, as a head's assignment of two trainers does (Step 21).
test("the multi select takes several, keeps its list open, and takes one out by its chip or Backspace", async ({
  page,
}) => {
  const [first, second, third] = design.combobox.people.map(([name]) => name);
  const chip = (name: string) =>
    page.getByRole("button", {
      name: design.multiSelect.remove.replace("{name}", name),
    });
  await expect(chip(first)).toBeVisible();
  await expect(chip(second)).toBeVisible();

  const field = page.getByRole("combobox", { name: design.multiSelect.label });
  await field.click();
  const list = page.getByRole("listbox", { name: design.multiSelect.list });
  await expect(list).toHaveAttribute("aria-multiselectable", "true");
  await expect(list.getByRole("option", { name: first })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // A digit typed on an Arabic keyboard finds an employee number.
  await field.fill("٢٠٠١٠٣");
  await list.getByRole("option", { name: third }).click();
  await expect(chip(third)).toBeVisible();
  await expect(list).toBeVisible();
  await expect(field).toHaveValue("");
  await expect(field).toBeFocused();

  await chip(second).click();
  await expect(chip(second)).toHaveCount(0);
  await field.press("Backspace");
  await expect(chip(third)).toHaveCount(0);
  await expect(chip(first)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
});

test("the bottom sheet takes focus, keeps Tab inside and gives focus back on close", async ({
  page,
}) => {
  const trigger = button(design.bottomSheet.trigger)(page);
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: design.bottomSheet.title });
  await expect(sheet).toHaveAccessibleDescription(
    design.bottomSheet.description,
  );
  const inside = () =>
    sheet.evaluate((element) => element.contains(document.activeElement));
  await expect.poll(inside).toBe(true);
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    expect(await inside()).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the command palette filters as you type and runs the chosen row", async ({
  page,
}) => {
  const palette = design.commandPalette;
  const trigger = button(palette.trigger)(page);
  await trigger.click();
  const field = page.getByRole("combobox", { name: palette.dialog });
  await expect(field).toBeFocused();
  const options = page.getByRole("listbox", { name: palette.list });
  await expect(options.getByRole("option")).toHaveCount(3);

  await field.fill(palette.two);
  await expect(options.getByRole("option")).toHaveText([palette.two]);
  await field.fill("zzz");
  await expect(options).toContainText(palette.empty);

  await field.fill("");
  await page.keyboard.press("ArrowDown");
  await expect(options.getByRole("option", { selected: true })).toHaveText(
    palette.two,
  );
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: palette.dialog })).toBeHidden();
  await expect(
    page.locator('[data-primitive="command-palette"]').getByRole("status"),
  ).toHaveText(palette.chosen.replace("{name}", palette.two));
  await expect(trigger).toBeFocused();
});

test("the toast shows in the status messages region", async ({ page }) => {
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
  // Without motion, axe measures the overlays' final colors rather than a frame of their fade. The
  // motion components read the preference once, as they mount, so the page loads with it.
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test.beforeEach(async ({ page }) => {
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
      await expect(page.getByRole(role, { name })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
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

  // The dialog animates on the slow token.
  const trigger = button(design.dialog.trigger)(page);
  const dialog = page.getByRole("dialog");
  const timing = () =>
    dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.animationDuration, style.transitionDuration];
    });
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect((await timing())[0]).toBe("0.2s");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await durations()).toEqual(["0s", "0s", "0s"]);
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect(await timing()).toEqual(["0s", "0s"]);
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

  // The period picker takes both too, so the left arrow moves to the next day.
  await labelled(design.period.label)(page).click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();

  // The previous month sits at the right edge, and both month arrows point outwards.
  const { dateRange } = messages;
  const previous = page.getByRole("button", { name: dateRange.previous.month });
  const next = page.getByRole("button", { name: dateRange.next.month });
  const [previousBox, nextBox] = [
    await previous.boundingBox(),
    await next.boundingBox(),
  ];
  expect(previousBox?.x).toBeGreaterThan(nextBox?.x ?? Infinity);
  await expect(previous.locator("svg")).toHaveCSS("scale", "-1 1");
  await expect(next.locator("svg")).toHaveCSS("scale", "-1 1");

  // The week starts on the college's first day (locale.weekStart, Sunday by default).
  const sunday = new Intl.DateTimeFormat("ar", {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2026, 0, 4));
  await expect(grid.locator("thead th").first()).toHaveAttribute(
    "abbr",
    sunday,
  );

  await grid.locator('button[aria-current="date"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(grid.locator("button:focus")).toHaveText("23");
});

test("a change brings Save and Discard, and Discard puts back what was saved", async ({
  page,
}) => {
  const section = page.locator('[data-primitive="save-actions"]');
  const field = section.getByRole("textbox", { name: design.label.text });
  const save = section.getByRole("button", { name: design.button.primary });
  await expect(save).toHaveCount(0);
  await field.fill(design.sample.placeholder);
  await section.getByRole("button", { name: messages.ui.discard }).click();
  await expect(field).toHaveValue(design.sample.value);
  await expect(save).toHaveCount(0);
});

test("the search announces what it found, and offers to clear a search that found nothing", async ({
  page,
}) => {
  const section = page.locator('[data-primitive="search"]');
  const field = section.getByRole("searchbox", { name: design.search.label });
  await field.fill("zzz");
  await expect(
    section.getByText(messages.ui.search.none.replace("{query}", "zzz")),
  ).toBeVisible();
  await section
    .getByRole("button", { name: messages.ui.search.clear })
    .last()
    .click();
  await expect(field).toHaveValue("");
  await expect(section.getByRole("listitem")).toHaveCount(
    design.search.items.length,
  );
});

test("the catalog never scrolls sideways on a 320 px phone", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "measured on the phone");
  await page.setViewportSize({ width: 320, height: 700 });
  // The stepper measures its new width before it draws its shapes again.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBe(0);
});

test("a stepper shows its whole number at either bound", async ({ page }) => {
  const stepper = (name: string) =>
    page.getByRole("group", { name, exact: true });
  // At its upper bound, only the button that lowers it is left.
  const full = stepper(design.stepper.full);
  await expect(full.getByRole("button")).toHaveCount(1);
  await expect.poll(() => valueOnTop(full)).toBe(true);
  // Stepped down to its lower bound, the other button leaves.
  const sections = stepper(design.stepper.label);
  const fewer = sections.getByRole("button", {
    name: design.stepper.decrease,
  });
  await fewer.click();
  await fewer.click();
  await expect(fewer).toHaveCount(0);
  await expect.poll(() => valueOnTop(sections)).toBe(true);
});

test("a progress bar exposes its value", async ({ page }) => {
  await expect(
    page.getByRole("progressbar", {
      name: design.progress.label.replace("{value}", "40"),
    }),
  ).toHaveAttribute("aria-valuenow", "40");
});

// Where an overlay's controls are, when its role above names only part of it.
const TOUCH_SCOPES: Record<string, (page: Page) => Locator> = {
  "date-range": (page) =>
    page.getByRole("dialog", { name: new RegExp(`^${design.period.label}`) }),
};

test.describe("touch targets", () => {
  test.skip(({ hasTouch }) => !hasTouch, "measured on the touch phone");
  // Without motion, a sheet is measured where it stops, not while it slides in: the page loads with
  // the preference, which the motion components read as they mount. The dev server's indicator
  // (absent from the standalone build CI tests) covers the page's bottom corner.
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector("nextjs-portal")?.remove(),
    );
  });

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
      // A fixed overlay does not scroll with the page, so it opens from the top of the screen,
      // where even the calendar, taller than half the phone, fits below its trigger.
      await trigger(page).evaluate((element) =>
        element.scrollIntoView({ block: "start" }),
      );
      await trigger(page).click();
      const overlay = page.getByRole(role, { name });
      await expect(overlay).toBeVisible();
      expect(await smallTargets(TOUCH_SCOPES[id]?.(page) ?? overlay)).toEqual(
        [],
      );
    });
  }
});
