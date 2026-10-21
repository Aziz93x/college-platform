import { findCollegeId } from "@/modules/org";
import { getSetting, settingsRegistry } from "@/modules/settings";
import { documentLocale } from "@/platform/i18n/language";

type LocaleKey =
  | "locale.language"
  | "locale.timeZone"
  | "locale.digits"
  | "locale.weekStart";

// The college's locale settings, read at request time: the document's language and direction,
// the time zone dates are shown in, and the locale next-intl formats with. That locale carries the
// college's first day of the week and digits as Unicode keywords (ar-u-fw-sun-nu-latn), so every
// date, number and calendar follows them. The registered defaults before db:seed has created a college.
export async function loadCollegeLocale(read = { findCollegeId, getSetting }) {
  const collegeId = await read.findCollegeId();
  const setting = <K extends LocaleKey>(key: K) =>
    collegeId === undefined
      ? settingsRegistry[key].default
      : read.getSetting(key, { collegeId });
  const [language, timeZone, digits, weekStart] = await Promise.all([
    setting("locale.language"),
    setting("locale.timeZone"),
    setting("locale.digits"),
    setting("locale.weekStart"),
  ]);
  return {
    ...documentLocale(language),
    timeZone,
    locale: `${language}-u-fw-${weekStart.slice(0, 3)}-nu-${digits}`,
  };
}
