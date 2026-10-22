import type {
  SettingControl,
  SettingGroup,
  SettingKey,
  SettingUnit,
} from "@/modules/settings";
import { toLatinDigits } from "@/platform/validation/digits";
import { foldCase, oneLine } from "@/platform/validation/text";

// What the screen draws of one setting the viewer may change. Its words come from the message
// catalog by key: settings.fields.<key>.label and .description.
export type SettingView = {
  key: SettingKey;
  group: SettingGroup;
  control: SettingControl;
  unit?: SettingUnit;
  // The value in force: the stored one, or the default while none is stored.
  value: unknown;
  defaultValue: unknown;
  // A security setting asks for the password again before it changes.
  needsPassword: boolean;
};

// The catalog's words a nullable text stands for while it is empty (src/i18n/platform-name.ts and
// src/components/pilot-banner.tsx read the same messages).
export const catalogDefaults: Partial<Record<SettingKey, string>> = {
  "platform.name": "platform.name",
  "pilot.bannerText": "platform.pilot",
};

export const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Whether a setting has a default to go back to: a value, or the catalog's words for an empty text.
// A Rayat column map has neither until the base seed writes Rayat's own.
export const resettable = (setting: SettingView) =>
  setting.defaultValue !== null || catalogDefaults[setting.key] !== undefined;

const ARABIC_PERCENT = String.fromCharCode(0x066a);

// What is typed into a list as the entry it adds, nothing while it is empty, or why it cannot join:
// a file extension in Latin letters and digits, written without its dot; a catalog's word on one
// line; or a whole percentage within the list's range, in either digits, its sign optional. No two
// entries are the same in any case of their Latin letters.
export function readListItem(
  control: Extract<SettingControl, { kind: "list" }>,
  typed: string,
  items: readonly string[],
):
  | { item: string }
  | { problem: "format" | "tooLong" | "range" | "duplicate" }
  | undefined {
  const read = (): ReturnType<typeof readListItem> => {
    if (control.item === "extension") {
      const item = toLatinDigits(typed.trim().toLowerCase().replace(/^\./, ""));
      if (!item) return undefined;
      return /^[a-z0-9]{1,10}$/.test(item) ? { item } : { problem: "format" };
    }
    if (control.item === "word") {
      const item = oneLine(typed);
      if (!item) return undefined;
      return item.length <= control.maxLength
        ? { item }
        : { problem: "tooLong" };
    }
    // A percent sign after the number, Latin or Arabic, is the list's own.
    const text = typed.trim();
    const signed = text.endsWith("%") || text.endsWith(ARABIC_PERCENT);
    const item = toLatinDigits((signed ? text.slice(0, -1) : text).trim());
    if (!item) return undefined;
    const bound = /^\d{1,3}$/.test(item) ? Number(item) : Number.NaN;
    return bound >= control.min && bound <= control.max
      ? { item: String(bound) }
      : { problem: "range" };
  };
  const entry = read();
  if (!entry || !("item" in entry)) return entry;
  const taken = items.some((item) => foldCase(item) === foldCase(entry.item));
  return taken ? { problem: "duplicate" } : entry;
}

// A columns control's texts as the value they stand for: each on one line, every field given one,
// and no two the same in any case of their Latin letters; or what is wrong with them.
export function readColumns(
  fields: readonly string[],
  shown: Readonly<Record<string, string>>,
):
  | { value: Record<string, string>; error?: undefined }
  | { value?: undefined; error: "columnsEmpty" | "columnsRepeated" } {
  const value = Object.fromEntries(
    fields.map((field) => [field, oneLine(shown[field] ?? "")]),
  );
  const texts = Object.values(value);
  if (texts.includes("")) return { error: "columnsEmpty" };
  if (new Set(texts.map(foldCase)).size < texts.length) {
    return { error: "columnsRepeated" };
  }
  return { value };
}
