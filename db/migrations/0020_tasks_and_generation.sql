-- The generation engine (Step 20, ADR-0025): a term's tasks, each in its slot, and the engine's
-- passes over a term; a framework item carries the item it was copied from. Its inverse drops tasks
-- and generation_runs, then framework_items.origin_id.
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"total" integer,
	"done" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"reassigned" integer DEFAULT 0 NOT NULL,
	"cancelled" integer DEFAULT 0 NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'ss01', 'transfer', 'daily')),
	CONSTRAINT "generation_runs_status" CHECK ("generation_runs"."status" in ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_item_id" uuid NOT NULL,
	"occurrence" integer NOT NULL,
	"section_ref" text DEFAULT '' NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"holder_id" uuid,
	"assignee_id" uuid,
	"assignee_number" text,
	"title" text NOT NULL,
	"axis_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"week" integer NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'notStarted' NOT NULL,
	"policy" jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_slot_unique" UNIQUE NULLS NOT DISTINCT("term_id","source","source_item_id","occurrence","department_id","section_ref","place","holder_id"),
	CONSTRAINT "tasks_source" CHECK ("tasks"."source" in ('framework')),
	CONSTRAINT "tasks_status" CHECK ("tasks"."status" in ('notStarted', 'inProgress', 'submitted', 'done', 'returned', 'notApplicable')),
	CONSTRAINT "tasks_occurrence" CHECK ("tasks"."occurrence" >= 1),
	CONSTRAINT "tasks_reach" CHECK (("tasks"."section_ref" = '' and "tasks"."place" = '' and "tasks"."holder_id" is not null) or ("tasks"."section_ref" <> '' and "tasks"."place" <> '' and "tasks"."holder_id" is null))
);
--> statement-breakpoint
ALTER TABLE "framework_items" ADD COLUMN "origin_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_runs_term_idx" ON "generation_runs" USING btree ("term_id","queued_at");--> statement-breakpoint
CREATE INDEX "generation_runs_waiting_idx" ON "generation_runs" USING btree ("queued_at") WHERE "generation_runs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "tasks_term_department_idx" ON "tasks" USING btree ("term_id","department_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id","due_on");--> statement-breakpoint
-- An item a draft copied before this migration names the item at its place in the version before,
-- with the same title, as the item it copies, so that publishing the draft reaches the same tasks
-- (Step 20). An item since renamed or moved reads as entered in its own version.
DO $$
DECLARE
  version_number integer;
BEGIN
  FOR version_number IN
    SELECT DISTINCT version FROM frameworks WHERE version > 1 ORDER BY version
  LOOP
    UPDATE framework_items AS later
    SET origin_id = coalesce(earlier.origin_id, earlier.id)
    FROM frameworks AS later_version, frameworks AS earlier_version, framework_items AS earlier
    WHERE later_version.id = later.framework_id
      AND later_version.version = version_number
      AND earlier_version.term_id = later_version.term_id
      AND earlier_version.version = version_number - 1
      AND earlier.framework_id = earlier_version.id
      AND earlier.position = later.position
      AND earlier.title = later.title
      AND later.origin_id IS NULL;
  END LOOP;
END $$;
