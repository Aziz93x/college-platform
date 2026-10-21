import type {
  SettingControl,
  SettingGroup,
  SettingKey,
  SettingUnit,
} from "@/modules/settings";

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
