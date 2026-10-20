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

// The document's language and direction. The direction comes from the language, so they never disagree.
export function documentLocale(language: string) {
  return {
    lang: language,
    dir: new Intl.Locale(language).getTextInfo().direction,
  };
}
