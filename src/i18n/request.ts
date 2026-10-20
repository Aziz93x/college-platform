import { getRequestConfig } from "next-intl/server";
import { loadCollegeLocale } from "./locale.ts";

// next-intl's per-request configuration; the language and the time zone are college settings, not
// part of the URL.
export default getRequestConfig(async () => {
  const { lang: locale, timeZone } = await loadCollegeLocale();
  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
