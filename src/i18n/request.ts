import { getRequestConfig } from "next-intl/server";
import { findCollegeId } from "@/modules/org";
import { applyTexts, collegeTexts } from "@/modules/texts";
import { shippedCatalog } from "./catalog.ts";
import { loadCollegeLocale } from "./locale.ts";

// next-intl's per-request configuration; the language, the digits and the time zone are college
// settings, not part of the URL. The college's own wording of any message lies over the language's
// catalog (ADR-0029).
export default getRequestConfig(async () => {
  const [{ lang, locale, timeZone }, collegeId] = await Promise.all([
    loadCollegeLocale(),
    findCollegeId(),
  ]);
  const catalog = await shippedCatalog(lang);
  return {
    locale,
    timeZone,
    messages:
      collegeId === undefined
        ? catalog
        : applyTexts(catalog, await collegeTexts(collegeId)),
  };
});
