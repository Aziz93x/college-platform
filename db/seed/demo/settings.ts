import {
  type SettingKey,
  type SettingValue,
  settings,
} from "../../../src/modules/settings/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// Stored rather than left to the registered defaults, so the app and its tests read stored values.
const demoSettings = {
  "locale.language": "ar",
} satisfies { [K in SettingKey]?: SettingValue<K> };

// A key already stored keeps its row, so a re-run changes nothing.
export async function seedDemoSettings({ db }: { db: Db }, collegeId: string) {
  await db
    .insert(settings)
    .values(
      Object.entries(demoSettings).map(([key, value]) => ({
        collegeId,
        key,
        value,
      })),
    )
    .onConflictDoNothing();
}
