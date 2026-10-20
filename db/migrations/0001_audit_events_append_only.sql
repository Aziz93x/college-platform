-- History is append-only (docs/PLAN.md, principle 4): these triggers reject every UPDATE, DELETE and
-- TRUNCATE of audit events, so a bug or a mistaken query cannot change history. They do not stop the
-- table owner, which is the app's own DATABASE_URL user (a superuser in compose and CI): any query run
-- as it, manual or injected, can disable the triggers or set session_replication_role = replica.
-- Step 11's retention purge, and any backfill in a later migration, needs its own allowed path past
-- these triggers.
CREATE FUNCTION "audit_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_update_or_delete" BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_append_only"();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_truncate" BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_events_append_only"();
