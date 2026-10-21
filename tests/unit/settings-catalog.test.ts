import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type SettingKey,
  settingControl,
  settingGroups,
  settingsRegistry,
} from "../../src/modules/settings/index.ts";

// Every catalog in messages/, by language.
const catalogs = readdirSync(new URL("../../messages/", import.meta.url))
  .filter((file) => file.endsWith(".json"))
  .map((file) => [
    file.replace(/\.json$/, ""),
    JSON.parse(
      readFileSync(new URL(`../../messages/${file}`, import.meta.url), "utf8"),
    ),
  ]);

// A message by its dotted path, as next-intl reads it.
const message = (catalog: object, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    );

const keys = Object.keys(settingsRegistry) as SettingKey[];

describe.each(catalogs)("the %s catalog", (_language, catalog) => {
  it.each(keys)("describes %s: a label and what it does", (key) => {
    for (const part of ["label", "description"]) {
      expect(message(catalog, `settings.fields.${key}.${part}`)).toEqual(
        expect.stringMatching(/\S/),
      );
    }
  });

  it("names every group, every choice and every unit the screen shows", () => {
    for (const group of settingGroups) {
      expect(message(catalog, `settings.groups.${group}`)).toBeTruthy();
    }
    for (const key of keys) {
      const control = settingControl(key);
      if (control?.kind === "choice") {
        for (const option of control.options) {
          expect(message(catalog, `settings.options.${option}`)).toBeTruthy();
        }
      }
      const setting = settingsRegistry[key];
      if ("unit" in setting) {
        expect(message(catalog, `settings.units.${setting.unit}`)).toBeTruthy();
      }
    }
  });
});
