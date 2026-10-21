import { getTranslations } from "next-intl/server";
import { findCollegeId } from "@/modules/org";
import { getSetting } from "@/modules/settings";

// The platform's name: the college's platform.name setting, or the message catalog's while it has
// none. The login page, the sidebar and every page title show it.
export async function platformName() {
  const collegeId = await findCollegeId();
  const [stored, t] = await Promise.all([
    collegeId ? getSetting("platform.name", { collegeId }) : null,
    getTranslations("platform"),
  ]);
  return stored ?? t("name");
}
