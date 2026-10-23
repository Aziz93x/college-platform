-- The admin's control panel (ADR-0029): the worker's beats, which the system page and the console
-- read, a college's own wording of the catalog's messages, and "admin" as the cause of a pass an
-- admin runs again. The system role holds the three new keys as it holds every key in code. Its
-- inverse deletes the passes caused by an admin, puts back the check without "admin", and drops
-- text_overrides and worker_heartbeats.
CREATE TABLE "worker_heartbeats" (
	"worker" text PRIMARY KEY NOT NULL,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "text_overrides" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "text_overrides_key" UNIQUE("college_id","key")
);
--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_reason";--> statement-breakpoint
ALTER TABLE "text_overrides" ADD CONSTRAINT "text_overrides_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_overrides" ADD CONSTRAINT "text_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'plan', 'assignment', 'ss01', 'transfer', 'periods', 'daily', 'admin'));