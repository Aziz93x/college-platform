import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

type PlanNode = {
  "Node Type": string;
  "Index Name"?: string;
  Plans?: PlanNode[];
};

// Each node of a plan from the top, named by the index it reads when it reads one.
const walk = (node: PlanNode): string[] => [
  node["Index Name"] ?? node["Node Type"],
  ...(node.Plans ?? []).flatMap(walk),
];

// A database that keeps the statements a reader sends, to read their plans as PostgreSQL would run
// them: whether a page reads its index in the index's order, with nothing to sort (lead review B).
export function recording(pool: Pool) {
  const sent: { query: string; params: unknown[] }[] = [];
  const db = drizzle({
    client: pool,
    logger: { logQuery: (query, params) => sent.push({ query, params }) },
  });
  async function plans() {
    const all: string[][] = [];
    for (const { query, params } of sent.splice(0)) {
      const { rows } = await pool.query(
        `explain (format json) ${query}`,
        params,
      );
      all.push(walk(rows[0]["QUERY PLAN"][0].Plan));
    }
    return all;
  }
  return { db, plans };
}
