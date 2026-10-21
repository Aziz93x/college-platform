import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { listDirectory, requireViewer } from "@/modules/access";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { HistoryPanel } from "../../audit/history-panel.tsx";
import { auditHref } from "../../audit/href.ts";
import { parseCursor } from "../../audit/query.ts";
import { AccountActions } from "../account-actions.tsx";
import { PersonForms } from "../person-forms.tsx";
import { peopleScope } from "../scope.ts";
import { STATE_BADGE } from "../state-badge.ts";
import { personView } from "../view.ts";

// The person the address names, when the viewer may see the people pages and reaches them: an
// address that is no one of the college's, or someone outside the viewer's departments, finds
// none. Read once for the title and the page.
const personFor = cache(async (id: string) => {
  const viewer = await requireViewer();
  const reach = peopleScope(viewer);
  if (!reach || !z.uuid().safeParse(id).success) {
    return { allowed: reach !== undefined, person: undefined };
  }
  const [[entry], departments, language] = await Promise.all([
    listDirectory(viewer.collegeId, { ...reach.only, userId: id }),
    listDepartments(viewer.collegeId),
    getSetting("locale.language", { collegeId: viewer.collegeId }),
  ]);
  const person =
    entry &&
    personView(entry, viewer, {
      manages: reach.manages,
      language,
      departmentName: (departmentId) =>
        departments.find((department) => department.id === departmentId)?.name,
    });
  return { allowed: true, person };
});

export async function generateMetadata({
  params,
}: PageProps<"/people/[id]">): Promise<Metadata> {
  await connection();
  const { person } = await personFor((await params).id);
  return { title: person?.name };
}

// One person: their account and roles, and what the viewer may change of it: the name and email,
// the employee number, a temporary password, and whether the account is disabled. Under it, for
// whoever may read the log, what happened to the account and the roles it holds.
export default async function PersonPage({
  params,
  searchParams,
}: PageProps<"/people/[id]">) {
  await connection();
  const { allowed, person } = await personFor((await params).id);
  if (!allowed) forbidden();
  if (!person) notFound();

  const [t, ui, { ui: uiWords, actions, people, reauth }] = await Promise.all([
    getTranslations("people"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <NextIntlClientProvider messages={{ ui: uiWords, actions, people, reauth }}>
      <PageHeader
        title={person.name}
        description={t("person.details")}
        breadcrumbs={[{ label: t("title"), href: "/people" }]}
        breadcrumbsLabel={ui("trail")}
        status={
          <AnimatedBadge status={STATE_BADGE[person.state]}>
            {t(`states.${person.state}`)}
          </AnimatedBadge>
        }
        actions={<AccountActions person={person} />}
      />
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">
                {t("person.employeeNumber")}
              </dt>
              <dd className="font-medium">{person.employeeNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                {t("person.email")}
              </dt>
              <dd className="font-medium">
                <bdi>{person.email}</bdi>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-sm">
                {t("person.roles")}
              </dt>
              <dd className="mt-1.5">
                {person.roles.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {person.roles.map((role) => (
                      <li
                        key={role.id}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-sm"
                      >
                        {role.label}
                        <span aria-hidden> · </span>
                        {role.place ?? t("college")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">{t("person.noRoles")}</p>
                )}
              </dd>
            </div>
          </dl>
        </section>
        <PersonForms person={person} />
      </div>
      <HistoryPanel
        subjects={[
          { entityType: "user", entityId: person.userId },
          { membershipsOf: "userId", value: person.userId },
        ]}
        // Their daily sign-ins and the notifications they read would bury what changed; the log
        // keeps them.
        except={["session.signIn", "session.signOut", "notification.read"]}
        logHref={auditHref("/audit", { q: person.employeeNumber })}
        after={parseCursor((await searchParams).history)}
        href={`/people/${person.userId}`}
      />
    </NextIntlClientProvider>
  );
}
