import { cache } from "react";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { colleges } from "./schema.ts";

// The deployment's college: the first one created, the one db:seed makes. Undefined before db:seed.
// Read once per request: the locale, the pilot banner and the shell all ask for it.
export const findCollege = cache(async (db: Db = getDb()) => {
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
});

// cache() keys on the arguments it is given, so the app's calls, which pass none, share one read.
export async function findCollegeId(db?: Db) {
  return (await (db ? findCollege(db) : findCollege()))?.id;
}
