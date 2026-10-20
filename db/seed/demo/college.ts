import { and, eq, ne, or, sql } from "drizzle-orm";
import { colleges } from "../../../src/modules/org/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// Synthetic: no real college carries this name.
export const demoCollege = {
  name: "الكلية التقنية بالواحة",
  shortName: "تقنية الواحة",
};

// db:seed may have created the college with its placeholder values; give it the demo values.
// Only a differing value is written, so a re-run changes nothing, updated_at included.
export async function seedDemoCollege({ db }: { db: Db }, collegeId: string) {
  await db
    .update(colleges)
    .set({
      name: demoCollege.name,
      shortName: demoCollege.shortName,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(colleges.id, collegeId),
        or(
          ne(colleges.name, demoCollege.name),
          ne(colleges.shortName, demoCollege.shortName),
        ),
      ),
    );
}
