import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getFormatter,
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  listRoles,
  permittedDepartments,
  requireViewer,
  roleHolders,
  roleLabel,
} from "@/modules/access";
import { listAxes } from "@/modules/axes";
import { listPeople } from "@/modules/identity";
import { listDepartments } from "@/modules/org";
import { requestLimits, termRequests } from "@/modules/requests";
import { getSetting } from "@/modules/settings";
import { isWorkingDay, termWeeks } from "@/modules/terms";
import { addDays, wallClock } from "@/platform/i18n/time-zone";
import { preparesTerms, termCalendar, viewedTerm } from "../_shell/term.ts";
import { type Place, type Reachable, RequestButton } from "./request-sheet.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("requests");
  return { title: t("title") };
}

// The quick requests of the term on view (Step 22): those of the whole college and of each
// department the viewer sends to, the latest first, and a sheet to send one. A head sends to their
// department; whoever holds requests.send across the college sends to one department or the whole
// college (the owner's answer). A closed term's requests are shown, and none is sent there.
export default async function RequestsPage() {
  await connection();
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  const sends = permittedDepartments(viewer, "requests.send");
  if (sends !== "college" && sends.length === 0) forbidden();
  const [t, { term }] = await Promise.all([
    getTranslations("requests"),
    viewedTerm(collegeId, preparesTerms(viewer)),
  ]);
  const header = (
    <PageHeader title={t("title")} description={t("description")} />
  );
  if (!term) {
    return (
      <>
        {header}
        <EmptyState
          title={t("noTerm.title")}
          description={t("noTerm.description")}
        />
      </>
    );
  }

  const [
    messages,
    locale,
    format,
    framework,
    departments,
    holders,
    everyone,
    roles,
    groups,
    requests,
    found,
    timeZone,
  ] = await Promise.all([
    getMessages(),
    getLocale(),
    getFormatter(),
    getTranslations("framework"),
    listDepartments(collegeId),
    roleHolders(collegeId, term.id),
    listPeople(collegeId),
    listRoles(collegeId),
    listAxes(collegeId),
    termRequests(collegeId, term.id, sends),
    termCalendar(collegeId, term.id),
    getSetting("locale.timeZone", { collegeId }),
  ]);
  // The departments the viewer sends to, in the college's order.
  const reached = departments.filter(
    ({ id, active }) => active && (sends === "college" || sends.includes(id)),
  );
  if (reached.length === 0 && sends !== "college") {
    return (
      <>
        {header}
        <EmptyState
          title={t("noPlace.title")}
          description={t("noPlace.description")}
        />
      </>
    );
  }

  const language = locale.split("-")[0];
  const nameOf = new Map(departments.map(({ id, name }) => [id, name]));
  const personOf = new Map(everyone.map((person) => [person.userId, person]));
  const roleOf = new Map(
    roles
      .filter((role) => !role.system)
      .map((role) => [role.id, roleLabel(role.labels, language)]),
  );
  // Whom a place's request may reach: those who hold a role there this term, as the generation
  // engine reaches them, by name; and the roles they hold.
  const placeOf = (id: string | null, name: string): Place => {
    const held = holders.filter(({ departmentId }) =>
      id === null
        ? reached.some((each) => each.id === departmentId)
        : departmentId === id,
    );
    const people = new Map<string, Reachable>();
    for (const { userId, departmentId } of held) {
      const person = personOf.get(userId);
      if (!person) continue;
      people.set(`${departmentId}:${userId}`, {
        userId,
        departmentId,
        name: person.name,
        employeeNumber: person.employeeNumber,
        description:
          id === null
            ? t("new.personIn", {
                department: nameOf.get(departmentId) ?? "",
                number: person.employeeNumber,
              })
            : person.employeeNumber,
      });
    }
    const roleIds = new Set(held.map(({ roleId }) => roleId));
    return {
      id,
      name,
      people: [...people.values()].sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
      roles: [...roleOf]
        .filter(([roleId]) => roleIds.has(roleId))
        .map(([roleId, label]) => ({ id: roleId, label })),
    };
  };
  const places = [
    ...(sends === "college" ? [placeOf(null, t("item.college"))] : []),
    ...reached.map(({ id, name }) => placeOf(id, name)),
  ];

  // The days a request may be due: from today, or the term's start, to the last of its counted
  // weeks, on the college's clock.
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const counted = found
    ? termWeeks(found.calendar).filter((week) => week.number !== null)
    : [];
  const first = counted[0]?.startsOn ?? term.startsOn;
  const last = counted.at(-1)?.endsOn ?? term.startsOn;
  const open = term.status !== "closed" && today <= last;
  // The days among them a request may not be due on, which the picker offers none of: outside the
  // counted weeks, or off in them, a weekend or a holiday (lead review D, proposal 6).
  const from = today > first ? today : first;
  const off: string[] = [];
  for (let each = from; found && each <= last; each = addDays(each, 1)) {
    const inWeek = counted.some(
      (week) => week.startsOn <= each && each <= week.endsOn,
    );
    if (!inWeek || !isWorkingDay(found.calendar, each)) off.push(each);
  }
  const axes = groups
    .flatMap((group) => group.axes)
    .map((axis) => ({
      value: axis.id,
      label: framework("axisOption", { code: axis.code, title: axis.title }),
    }));

  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "full",
      timeZone: "UTC",
    });
  const placeName = (departmentId: string | null) =>
    departmentId === null
      ? t("item.college")
      : (nameOf.get(departmentId) ?? "");
  const shown = requests.map((request) => {
    const place = placeName(request.departmentId);
    const { targets } = request;
    return {
      id: request.id,
      title: request.title,
      place,
      due: t("item.due", { date: day(request.dueOn) }),
      reach:
        "roleId" in targets
          ? t("targets.role", { role: roleOf.get(targets.roleId) ?? "", place })
          : "people" in targets
            ? t("targets.people", { count: targets.people.length })
            : t("targets.everyone", { place }),
      evidence: request.evidence.required
        ? t("item.evidence")
        : t("item.noEvidence"),
      from: t("item.from", {
        name: request.sentBy ?? t("item.unknown"),
        date: format.dateTime(request.createdAt, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      }),
    };
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          open && axes.length > 0 ? (
            <NextIntlClientProvider
              messages={{
                ui: messages.ui,
                actions: messages.actions,
                dateRange: messages.dateRange,
                requests: messages.requests,
              }}
            >
              <RequestButton
                termId={term.id}
                places={places}
                axes={axes}
                title={requestLimits.title}
                day={{ min: from, max: last, today, off }}
              />
            </NextIntlClientProvider>
          ) : undefined
        }
      />
      {term.status === "closed" ? (
        <p className="-mt-2 mb-6 px-1 text-muted-foreground text-sm">
          {t("closed")}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <section
          aria-labelledby="requests-list"
          className="rounded-xl border bg-card shadow-xs"
        >
          <h2 id="requests-list" className="border-b px-5 py-4 text-lg sm:px-6">
            {t("list")}
          </h2>
          <ul className="flex flex-col divide-y">
            {shown.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-1.5 px-5 py-4 sm:px-6"
              >
                <h3 className="font-medium text-base">{request.title}</h3>
                <p className="text-sm">
                  {[request.place, request.due].join(" · ")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {[request.reach, request.evidence].join(" · ")}
                </p>
                <p className="text-muted-foreground text-sm">{request.from}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
