import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/motion/alert";
import { findCollegeId } from "@/modules/org";
import { getSetting } from "@/modules/settings";

// The strip above every page while the platform is on trial (pilot.banner), with the college's own
// words (pilot.bannerText) or the catalog's.
export async function PilotBanner() {
  const collegeId = await findCollegeId();
  const scope = collegeId ? { collegeId } : undefined;
  const [shown, text, t] = await Promise.all([
    scope ? getSetting("pilot.banner", scope) : true,
    scope ? getSetting("pilot.bannerText", scope) : null,
    getTranslations("platform"),
  ]);
  if (!shown) return null;
  return (
    <Alert
      variant="info"
      className="rounded-none px-4 py-2"
      contentClassName="justify-center"
    >
      <p className="text-pretty">{text ?? t("pilot")}</p>
    </Alert>
  );
}
