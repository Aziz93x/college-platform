import type { Pool } from "pg";

/** An SQL condition that leaves out PostgreSQL's own schemas. */
export const nonSystem = (column: string) =>
  `${column} not in ('pg_catalog', 'information_schema') and ${column} not like 'pg\\_%'`;

// Every row of every table outside PostgreSQL's own schemas (the app's, Drizzle's and pg-boss's),
// as sorted JSON keyed by schema.table, without the columns named in `omit`.
export async function tableRows(pool: Pool, omit: string[] = []) {
  const { rows: tables } = await pool.query(`
    select table_schema, table_name from information_schema.tables
    where table_type = 'BASE TABLE' and ${nonSystem("table_schema")} order by 1, 2`);
  const snapshot: Record<string, string[]> = {};
  for (const { table_schema, table_name } of tables) {
    const { rows } = await pool.query(
      `select to_jsonb(t) as row from "${table_schema}"."${table_name}" t`,
    );
    snapshot[`${table_schema}.${table_name}`] = rows
      .map(({ row }) =>
        JSON.stringify(
          Object.entries(row).filter(([column]) => !omit.includes(column)),
        ),
      )
      .sort();
  }
  return snapshot;
}
