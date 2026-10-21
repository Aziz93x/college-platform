import { authorize, permittedDepartments } from "@/modules/access";

// The keys the people pages serve: whoever holds one sees the people it reaches.
const KEYS = [
  "people.manage",
  "accounts.resetPassword",
  "accounts.linkEmployeeNumber",
] as const;

type Viewer = Parameters<typeof permittedDepartments>[0];

// Whom a viewer sees on the people pages: the whole college with any of the keys held across it,
// otherwise the people of the departments where they hold one; undefined with none of them.
export function peopleScope(viewer: Viewer) {
  const scopes = KEYS.map((key) => permittedDepartments(viewer, key));
  const departments = [
    ...new Set(scopes.flatMap((each) => (each === "college" ? [] : each))),
  ];
  const everyone = scopes.includes("college");
  if (!everyone && departments.length === 0) return undefined;
  return {
    only: everyone ? {} : { departments },
    manages: authorize(viewer, "people.manage", {
      collegeId: viewer.collegeId,
    }),
  };
}
