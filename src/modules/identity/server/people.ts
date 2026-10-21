import { asc, eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { people, users } from "./schema.ts";

// The college's people by name, as a list to choose someone from.
export async function listPeople(collegeId: string, db: Db = getDb()) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      employeeNumber: people.employeeNumber,
    })
    .from(people)
    .innerJoin(users, eq(users.id, people.userId))
    .where(eq(people.collegeId, collegeId))
    .orderBy(asc(users.name));
}
