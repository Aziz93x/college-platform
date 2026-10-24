import { getFormatter, getTranslations } from "next-intl/server";
import { authorize, permittedDepartments } from "@/modules/access";
import {
  type ReadinessRow,
  type RowCatalog,
  rowWords,
} from "@/modules/readiness";
import { peopleScope } from "../people/scope.ts";
import { planAccess } from "../plan/access.ts";

type Viewer = Parameters<typeof authorize>[0];

// Whether the viewer opens the page that settles a row, by the rule that page itself applies, so
// nothing offers them a page that would refuse them; the row's owners are named either way (lead
// review D, M5). The term's page and the framework open to everyone.
export function rowOpens(viewer: Viewer) {
  const plans = planAccess(viewer);
  const rayat = permittedDepartments(viewer, "rayat.import");
  const importer = rayat === "college" || rayat.length > 0;
  return (row: ReadinessRow) => {
    switch (row.id) {
      case "people":
        return peopleScope(viewer) !== undefined;
      case "matched":
        return row.href === "/people"
          ? peopleScope(viewer) !== undefined
          : importer;
      case "rayat":
        return importer;
      case "plan":
        return plans.opens(row.departmentId);
      case "tasks":
        return (
          row.href !== "/system" ||
          authorize(viewer, "system.manage", { collegeId: viewer.collegeId })
        );
      case "term":
      case "framework":
        return true;
    }
  };
}

// A row's title and what it waits on, in the viewer's language (Step 22; lead review D, proposal 5).
export async function readinessWords() {
  const [t, rayat, format] = await Promise.all([
    getTranslations("readiness"),
    getTranslations("rayat"),
    getFormatter(),
  ]);
  const catalog: RowCatalog = {
    readiness: (key, values) => t(key as never, values as never),
    rayat: (key, values) => rayat(key as never, values as never),
    list: (items) => format.list(items),
  };
  return (row: ReadinessRow) => rowWords(row, catalog);
}
