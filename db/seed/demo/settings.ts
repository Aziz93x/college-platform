import {
  type SettingKey,
  type SettingValue,
  settings,
} from "../../../src/modules/settings/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The demo college's own words and clock, stored rather than left to the registered defaults, so
// the app and its tests read stored values: the login page's names and banner come from here
// (e2e/auth.spec.ts).
export const demoSettings = {
  "locale.language": "ar",
  "locale.timeZone": "Asia/Riyadh",
  "platform.name": "منصة أعمال الأقسام بتقنية الواحة",
  "pilot.bannerText":
    "نسخة عرض ببيانات تجريبية: الأسماء والأرقام فيها ليست لأشخاص حقيقيين.",
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
