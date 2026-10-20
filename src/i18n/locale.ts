import { findCollegeId } from "@/modules/org";
import { getSetting, settingsRegistry } from "@/modules/settings";

declare global {
  namespace Intl {
    // Node 24 implements it; TypeScript 5.9's lib does not declare it yet.
    interface Locale {
      getTextInfo(): { direction: "ltr" | "rtl" };
    }
  }
}

// The document's language and direction. The direction comes from the language, so they never disagree.
export function documentLocale(language: string) {
  return {
    lang: language,
    dir: new Intl.Locale(language).getTextInfo().direction,
  };
}

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
