import type { Catalog } from "@/modules/texts";
import { loadCollegeLocale } from "./locale.ts";

// A language's catalog as the release ships it, before any college's own wording (ADR-0029).
export async function shippedCatalog(lang: string): Promise<Catalog> {
  return (await import(`../../messages/${lang}.json`)).default;
}

// The college's language's catalog as shipped: what the texts page lists, and what a change to
// one of its texts is checked against.
export async function collegeCatalog() {
  return shippedCatalog((await loadCollegeLocale()).lang);
}
