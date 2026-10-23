import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Each worker's last beat: its heartbeat job writes the time every minute, so the system page and
// the console tell a worker that stopped (ADR-0029). The platform's, not a college's.
export const workerHeartbeats = pgTable("worker_heartbeats", {
  worker: text().primaryKey(),
  beatAt: timestamp("beat_at", { withTimezone: true }).notNull().defaultNow(),
});
