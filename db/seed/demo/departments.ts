import { and, eq } from "drizzle-orm";
import {
  departmentRayatValues,
  departments,
} from "../../../src/modules/org/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The demo college's departments, with the ways Rayat's exports write each one in their
// department column.
export const demoDepartments = [
  {
    name: "الدراسات العامة",
    shortName: "العامة",
    rayatValues: ["الدراسات العامة", "قسم الدراسات العامة"],
  },
  {
    name: "التقنية الكهربائية",
    shortName: "الكهربائية",
    rayatValues: ["التقنية الكهربائية", "قسم التقنية الكهربائية"],
  },
  {
    name: "التقنية الميكانيكية",
    shortName: "الميكانيكية",
    rayatValues: ["التقنية الميكانيكية", "قسم التقنية الميكانيكية"],
  },
];

// A department or a value already stored keeps its row, so a re-run changes nothing.
export async function seedDemoDepartments(
  { db }: { db: Db },
  collegeId: string,
) {
  for (const { rayatValues, ...department } of demoDepartments) {
    await db
      .insert(departments)
      .values({ collegeId, ...department })
      .onConflictDoNothing();
    const [{ id }] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          eq(departments.collegeId, collegeId),
          eq(departments.name, department.name),
        ),
      );
    await db
      .insert(departmentRayatValues)
      .values(
        rayatValues.map((value) => ({ collegeId, departmentId: id, value })),
      )
      .onConflictDoNothing();
  }
}
