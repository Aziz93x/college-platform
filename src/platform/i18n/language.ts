// The interface languages: one for each catalog in messages/. The first is the default, which
// pages that cannot read the college's settings fall back to (src/app/global-error.tsx).
export const languages = ["ar"] as const;

// How Intl.Locale says a language is written. getTextInfo() is recent (Safari 17, Chrome 130,
// Firefox 153): Safari 15.4 to 16 and Chrome 99 to 129 have the textInfo property instead, and
// Firefox before 153 neither, so the cast names both as optional. Called unguarded in a module every
// page loads (src/app/global-error.tsx), it threw there and React never started.
type Direction = "ltr" | "rtl";
type WithTextInfo = Intl.Locale & {
  getTextInfo?: () => { direction: Direction };
  readonly textInfo?: { direction: Direction };
};

// Scripts written right to left (ISO 15924), for an engine that says nothing: maximize() gives the
// language's script in every browser the platform supports.
const RIGHT_TO_LEFT = new Set([
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Mend",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
  "Yezi",
]);

function directionOf(locale: Intl.Locale): Direction {
  const known = locale as WithTextInfo;
  const info = known.getTextInfo?.() ?? known.textInfo;
  if (info) return info.direction;
  return RIGHT_TO_LEFT.has(locale.maximize().script ?? "") ? "rtl" : "ltr";
}

// The document's language and direction, from a language or a locale with extensions (next-intl's
// ar-u-nu-latn gives lang="ar"). The direction comes from the language, so they never disagree.
export function documentLocale(locale: string) {
  const { baseName } = new Intl.Locale(locale);
  return { lang: baseName, dir: directionOf(new Intl.Locale(baseName)) };
}

// The first day of the week a locale names with its fw keyword (ar-u-fw-sun), numbered from Sunday
// as react-day-picker and JavaScript dates count; Sunday when it names none. Intl.Locale reads the
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
