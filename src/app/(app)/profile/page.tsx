import { BellRing, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { listDirectory, requireViewer, roleLabel } from "@/modules/access";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("profile");
  return { title: t("title") };
}

// The signed-in person's own account: their name, email and employee number, their roles and
// where, whether two-factor guards it, the way to change the password, and to their notification
// preferences. A trainer's
// professional profile joins it in Step 28.
export default async function ProfilePage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const [t, [person], departments, language] = await Promise.all([
    getTranslations("profile"),
    listDirectory(viewer.collegeId, { userId: viewer.userId }),
    listDepartments(viewer.collegeId),
    getSetting("locale.language", scope),
  ]);
  const roles = (person?.memberships ?? []).map((membership) => ({
    id: membership.id,
    label: roleLabel(membership.roleLabels, language),
    place:
      membership.departmentId === null
        ? t("college")
        : departments.find(({ id }) => id === membership.departmentId)?.name,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-6">
        <section
          aria-labelledby="profile-account"
          className="rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
        >
          <h2 id="profile-account" className="font-medium text-base">
            {t("account")}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">{t("name")}</dt>
              <dd className="font-medium">{viewer.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t("employeeNumber")}
              </dt>
              <dd className="font-medium">{person?.employeeNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-sm">{t("email")}</dt>
              <dd className="font-medium">
                <bdi>{viewer.email}</bdi>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-sm">{t("roles")}</dt>
              <dd className="mt-1.5">
                {roles.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {roles.map((role) => (
                      <li
                        key={role.id}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-sm"
                      >
                        {role.label}
                        <span aria-hidden> · </span>
                        {role.place}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">{t("noRoles")}</p>
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section
          aria-labelledby="profile-security"
          className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
        >
          <h2 id="profile-security" className="font-medium text-base">
            {t("security")}
          </h2>
          <p className="text-sm">
            {viewer.twoFactorEnabled ? t("twoFactorOn") : t("twoFactorOff")}
          </p>
          <Button asChild variant="outline" className="h-11 self-start">
            <Link href="/change-password">
              <KeyRound aria-hidden />
              {t("changePassword")}
            </Link>
          </Button>
        </section>
        <section
          aria-labelledby="profile-notifications"
          className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
        >
          <h2 id="profile-notifications" className="font-medium text-base">
            {t("notifications")}
          </h2>
          <p className="text-sm">{t("notificationsHint")}</p>
          <Button asChild variant="outline" className="h-11 self-start">
            <Link href="/notifications/preferences">
              <BellRing aria-hidden />
              {t("notificationPreferences")}
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
