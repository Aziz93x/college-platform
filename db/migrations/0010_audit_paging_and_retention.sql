CREATE INDEX "audit_events_college_time_idx" ON "audit_events" USING btree ("college_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("college_id","actor_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("college_id","entity_type","entity_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
-- The retention purge is the one way past the append-only triggers (Audit 1, ADR-0008): a DELETE
-- passes only while purge_audit_events() runs, which turns audit.purging on for its own statement.
-- Any role may set that variable, so db:migrate leaves the app's role no UPDATE or DELETE on the
-- table, only the function.
CREATE OR REPLACE FUNCTION "audit_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('audit.purging', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP;
END;
$$;--> statement-breakpoint
-- Removes one college's events older than the given months. It runs as the table's owner, and keeps
-- at least 12 months whoever calls it, so the app's role cannot shorten history below the
-- retention setting's least value (audit.retentionMonths).
CREATE FUNCTION "purge_audit_events"("p_college" uuid, "p_months" integer) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  "removed" integer;
BEGIN
  IF "p_months" IS NULL OR "p_months" < 12 THEN
    RAISE EXCEPTION 'purge_audit_events keeps at least 12 months, not %', "p_months";
  END IF;
  PERFORM set_config('audit.purging', 'on', true);
  DELETE FROM public.audit_events
    WHERE college_id = "p_college" AND created_at < now() - make_interval(months => "p_months");
  GET DIAGNOSTICS "removed" = ROW_COUNT;
  PERFORM set_config('audit.purging', 'off', true);
  RETURN "removed";
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "purge_audit_events"(uuid, integer) FROM PUBLIC;
--> statement-breakpoint
-- Better Auth locks two-factor after ten wrong codes in a row and records nothing (Audit 2). The
-- lock is recorded once, as the system's act, when locked_until moves into the future; the counter
-- that climbs during a lock, and the clearing of an expired one, record nothing.
CREATE FUNCTION "two_factors_audit_lock"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_events (college_id, actor_id, action, entity_type, entity_id, diff)
  SELECT p.college_id, NULL, 'account.lockTwoFactor', 'user', NEW.user_id::text,
    jsonb_build_object('lockedUntil', to_char(NEW.locked_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  FROM people p WHERE p.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "two_factors_audit_lock" AFTER UPDATE OF "locked_until" ON "two_factors"
  FOR EACH ROW WHEN (NEW.locked_until > now() AND (OLD.locked_until IS NULL OR OLD.locked_until <= now()))
  EXECUTE FUNCTION "two_factors_audit_lock"();
