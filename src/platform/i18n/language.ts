declare global {
  namespace Intl {
    // Node 24 implements it; TypeScript 5.9's lib does not declare it yet.
    interface Locale {
      getTextInfo(): { direction: "ltr" | "rtl" };
    }
  }
}

// The interface languages: one for each catalog in messages/. The first is the default, which
// pages that cannot read the college's settings fall back to (src/app/global-error.tsx).
export const languages = ["ar"] as const;

// The document's language and direction, from a language or a locale with extensions (next-intl's
// ar-u-nu-latn gives lang="ar"). The direction comes from the language, so they never disagree.
export function documentLocale(locale: string) {
  const { baseName } = new Intl.Locale(locale);
  return {
    lang: baseName,
    dir: new Intl.Locale(baseName).getTextInfo().direction,
  };
}

// The first day of the week a locale names with its fw keyword (ar-u-fw-sun), numbered from Sunday
// as the date range picker and JavaScript dates count; Sunday when it names none. Intl.Locale reads the
// keyword in few engines yet, so it is read from the tag.
const FIRST_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function firstDayOfWeek(locale: string) {
  const day = /-u(?:-[a-z0-9]{2,8})*?-fw-([a-z]{3})\b/.exec(locale)?.[1];
  return Math.max(0, FIRST_DAYS.indexOf(day ?? "sun")) as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
}
