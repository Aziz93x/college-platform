import { findCollegeId } from "@/modules/org";
import { getSetting, settingsRegistry } from "@/modules/settings";
import { documentLocale } from "@/platform/i18n/language";

type LocaleKey = "locale.language" | "locale.timeZone";

// The college's locale settings, read at request time: the document's language and direction,
// and the time zone dates are shown in. The registered defaults before db:seed has created a college.
export async function loadCollegeLocale(read = { findCollegeId, getSetting }) {
  const collegeId = await read.findCollegeId();
  const setting = <K extends LocaleKey>(key: K) =>
    collegeId === undefined
      ? settingsRegistry[key].default
      : read.getSetting(key, { collegeId });
  const [language, timeZone] = await Promise.all([
    setting("locale.language"),
    setting("locale.timeZone"),
  ]);
  return { ...documentLocale(language), timeZone };
}
