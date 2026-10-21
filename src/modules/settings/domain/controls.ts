import { z } from "zod";
import {
  type SettingKey,
  type SettingUnit,
  settingsRegistry,
} from "./registry.ts";

// The control the settings screen draws for a setting, read from its schema. A schema with no
// control (a map, such as navigation.order) keeps its setting off the screen.
export type SettingControl =
  | { kind: "switch" }
  | { kind: "choice"; options: readonly string[] }
  // A percentage on a slider; a short count stepped one at a time; a wider range typed.
  | { kind: "slider" | "stepper" | "number"; min: number; max: number }
  // A nullable text is left empty for the default (the message catalog's words).
  | { kind: "text"; maxLength: number; nullable: boolean }
  | { kind: "list" };

// The widest range a stepper walks through; taking 1 to 1,440 minutes one press at a time is not
// a control anyone wants.
const STEPPER_RANGE = 100;

export function controlFor(
  schema: z.ZodType,
  unit?: SettingUnit,
): SettingControl | undefined {
  if (schema instanceof z.ZodBoolean) return { kind: "switch" };
  if (schema instanceof z.ZodEnum) {
    return { kind: "choice", options: schema.options.map(String) };
  }
  if (schema instanceof z.ZodNumber) {
    const min = schema.minValue ?? 0;
    const max = schema.maxValue ?? Number.MAX_SAFE_INTEGER;
    if (unit === "percent") return { kind: "slider", min, max };
    return {
      kind: max - min <= STEPPER_RANGE ? "stepper" : "number",
      min,
      max,
    };
  }
  const nullable = schema instanceof z.ZodNullable;
  const inner = nullable ? schema.unwrap() : schema;
  if (inner instanceof z.ZodString) {
    return { kind: "text", maxLength: inner.maxLength ?? 1000, nullable };
  }
  if (inner instanceof z.ZodArray && inner.element instanceof z.ZodString) {
    return { kind: "list" };
  }
  return undefined;
}

export function settingControl(key: SettingKey) {
  const setting = settingsRegistry[key];
  return controlFor(
    setting.schema,
    "unit" in setting ? setting.unit : undefined,
  );
}
