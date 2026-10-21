-- Every sign-in attempt deletes the attempt windows and lockout counts that have ended; these
-- indexes keep that from scanning the tables, which an enumeration run fills (lead review A).
CREATE INDEX "sign_in_attempts_window_started_at_idx" ON "sign_in_attempts" USING btree ("window_started_at");--> statement-breakpoint
CREATE INDEX "sign_in_lockouts_started_at_idx" ON "sign_in_lockouts" USING btree ("started_at");