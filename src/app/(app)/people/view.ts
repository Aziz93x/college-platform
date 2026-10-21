import { type PersonEntry, reachesAccount, roleLabel } from "@/modules/access";
import type { AccountState } from "@/modules/identity";

type Viewer = Parameters<typeof reachesAccount>[0];

// A person as the people list and their page draw them, with what the viewer may do to their
// account: the server decides each action again when it runs.
export type PersonView = {
  userId: string;
  name: string;
  email: string;
  employeeNumber: string;
  state: AccountState;
  roles: { id: string; label: string; place: string | null }[];
  can: {
    reset: boolean;
    link: boolean;
    edit: boolean;
    // Disable or enable the account: never one's own.
    disable: boolean;
  };
};

export function personView(
  person: PersonEntry,
  viewer: Viewer & { userId: string },
  {
    manages,
    language,
    departmentName,
  }: {
    manages: boolean;
    language: string;
    departmentName: (id: string) => string | undefined;
  },
): PersonView {
  return {
    userId: person.userId,
    name: person.name,
    email: person.email,
    employeeNumber: person.employeeNumber,
    state: person.state,
    roles: person.memberships.map((membership) => ({
      id: membership.id,
      label: roleLabel(membership.roleLabels, language),
      place:
        membership.departmentId === null
          ? null
          : (departmentName(membership.departmentId) ?? null),
    })),
    can: {
      reset: reachesAccount(viewer, "accounts.resetPassword", person),
      link: reachesAccount(viewer, "accounts.linkEmployeeNumber", person),
      edit: manages,
      disable: manages && person.userId !== viewer.userId,
    },
  };
}
