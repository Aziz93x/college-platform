-- A department's plan for a term, version by version (Step 19): a draft its head fills, then
-- publishes to generate its tasks, after which it never changes. The section templates of Step 18
-- become the items of a first draft of their department's plan for their term, each keeping its id,
-- position and fields; migration 0024 drops their table. A task gains the source "plan", a pass of
-- the generation engine the cause "plan", and the head the key plan.publish. Its inverse moves the
-- drafts' items for each section's or each course's trainer back into section_templates (0020),
-- deletes the tasks and passes the plans caused, drops plan_items and plans, puts back both checks,
-- and takes plan.publish from the heads.
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"origin_id" uuid,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"axis_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"applies_to" jsonb NOT NULL,
	"due" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "plans_version_unique" UNIQUE("term_id","department_id","version"),
	CONSTRAINT "plans_status" CHECK ("plans"."status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_reason";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_source";--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_fk" FOREIGN KEY ("college_id","plan_id") REFERENCES "public"."plans"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_items_plan_idx" ON "plan_items" USING btree ("plan_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_draft_idx" ON "plans" USING btree ("term_id","department_id") WHERE "plans"."status" = 'draft';--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'plan', 'ss01', 'transfer', 'periods', 'daily'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source" CHECK ("tasks"."source" in ('framework', 'plan'));--> statement-breakpoint
INSERT INTO "plans" ("college_id", "term_id", "department_id", "version") SELECT DISTINCT "college_id", "term_id", "department_id", 1 FROM "section_templates";--> statement-breakpoint
INSERT INTO "plan_items" ("id", "college_id", "plan_id", "position", "title", "axis_id", "kind", "applies_to", "due", "evidence", "notes", "created_at", "updated_at") SELECT t."id", t."college_id", p."id", t."position", t."title", t."axis_id", t."kind", t."applies_to", t."due", t."evidence", t."notes", t."created_at", t."updated_at" FROM "section_templates" t JOIN "plans" p ON p."term_id" = t."term_id" AND p."department_id" = t."department_id";--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'plan.publish' FROM "roles" WHERE "key" = 'head' ON CONFLICT DO NOTHING;
