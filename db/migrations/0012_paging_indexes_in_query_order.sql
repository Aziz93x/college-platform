-- Lead review B: the paging indexes in the order the queries ask, desc() with nulls first. Built
-- with nulls last, no ORDER BY used them, and each first page sorted the whole table. The log's
-- action filter gets an index of its own, and the bell's unread index ends with the id, as its
-- query orders. Its inverse recreates migrations 0010's and 0011's indexes and drops the new one.
DROP INDEX "audit_events_college_time_idx";--> statement-breakpoint
DROP INDEX "audit_events_actor_idx";--> statement-breakpoint
DROP INDEX "audit_events_entity_idx";--> statement-breakpoint
DROP INDEX "notifications_user_time_idx";--> statement-breakpoint
DROP INDEX "notifications_unread_idx";--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("college_id","action","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_events_college_time_idx" ON "audit_events" USING btree ("college_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("college_id","actor_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("college_id","entity_type","entity_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "notifications_user_time_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "notifications"."read_at" is null;