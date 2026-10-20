import { type Db, getDb } from "../../../platform/db/client.ts";
import { colleges } from "./schema.ts";

// The deployment's college: the first one created, the one db:seed makes. Undefined before db:seed.
export async function findCollege(db: Db = getDb()) {
  const [row] = await db
    .select({
      id: colleges.id,
      name: colleges.name,
      shortName: colleges.shortName,
    })
    .from(colleges)
    .orderBy(colleges.createdAt, colleges.id)
    .limit(1);
  return row;
}

export async function findCollegeId(db: Db = getDb()) {
  return (await findCollege(db))?.id;
}
