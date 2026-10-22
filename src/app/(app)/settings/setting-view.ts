import type {
  SettingControl,
  SettingGroup,
  SettingKey,
  SettingUnit,
} from "@/modules/settings";
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
