import { sql } from "drizzle-orm";
import type { Tx } from "./client.ts";

// One change at a time to what a college keeps unique across its departments, roles and people,
// held until the transaction ends. An advisory lock, not the college's row: a lock on the row stops
// every insert that names the college (sign-ins, audit events, notifications) for as long as it is
// held, and an import holds it for seconds (lead review B).
export function lockCollege(tx: Tx, collegeId: string) {
  return tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`college:${collegeId}`}, 0))`,
  );
}
