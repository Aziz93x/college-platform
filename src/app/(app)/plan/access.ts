import { permittedDepartments } from "@/modules/access";

type Viewer = Parameters<typeof permittedDepartments>[0];
type Held = ReturnType<typeof permittedDepartments>;

const holds = (keys: Held, departmentId: string) =>
  keys === "college" || keys.includes(departmentId);

// Whose plans a viewer opens on /plan, and what they do there: edit a department's plan where they
// hold plan.edit, publish it where they hold plan.publish, and read it where they hold any of the
// three, plan.view the key of whoever only reads it, such as the vice-dean (lead review D,
// proposal 3). The readiness board links a department's plan by the same rule (M5).
export function planAccess(viewer: Viewer) {
  const edits = permittedDepartments(viewer, "plan.edit");
  const publishes = permittedDepartments(viewer, "plan.publish");
  const reads = permittedDepartments(viewer, "plan.view");
  const all = [edits, publishes, reads];
  return {
    any: all.some((keys) => keys === "college" || keys.length > 0),
    opens: (departmentId: string) =>
      all.some((keys) => holds(keys, departmentId)),
    edits: (departmentId: string) => holds(edits, departmentId),
    publishes: (departmentId: string) => holds(publishes, departmentId),
  };
}
