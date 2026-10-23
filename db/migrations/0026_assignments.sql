-- Assignments (Step 21): templates of the responsibilities a head gives trainers beside their
-- teaching, shared by every department or a department's own, with their items; and each template
-- given to a person of a department for a term, the whole of it or a range of its weeks, with the
-- membership it added where its template grants a role. The base seed gives each college the six
-- shared templates of today's app, the secretary's granting the secretary's role. A task gains the
-- source "assignment", a pass of the generation engine the cause "assignment", and the head the key
-- assignment.manage. Its inverse deletes the memberships the assignments added and the tasks and
-- passes they caused, drops assignments, assignment_template_items and assignment_templates, puts
-- back both checks, and takes assignment.manage from the heads.
CREATE TABLE "assignment_template_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"department_id" uuid,
	"key" text,
	"title" text NOT NULL,
	"axis_id" uuid NOT NULL,
	"grants_role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_templates_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "assignment_templates_key_unique" UNIQUE("college_id","key")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_week" integer,
	"to_week" integer,
	"membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_holder_unique" UNIQUE("term_id","department_id","template_id","user_id"),
	CONSTRAINT "assignments_weeks" CHECK (("assignments"."from_week" is null and "assignments"."to_week" is null) or (1 <= "assignments"."from_week" and "assignments"."from_week" <= "assignments"."to_week"))
);
--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_reason";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_source";--> statement-breakpoint
ALTER TABLE "assignment_template_items" ADD CONSTRAINT "assignment_template_items_template_fk" FOREIGN KEY ("college_id","template_id") REFERENCES "public"."assignment_templates"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_templates" ADD CONSTRAINT "assignment_templates_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_templates" ADD CONSTRAINT "assignment_templates_grants_role_id_roles_id_fk" FOREIGN KEY ("grants_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_templates" ADD CONSTRAINT "assignment_templates_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_templates" ADD CONSTRAINT "assignment_templates_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_template_fk" FOREIGN KEY ("college_id","template_id") REFERENCES "public"."assignment_templates"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_template_items_template_idx" ON "assignment_template_items" USING btree ("template_id","position");--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'plan', 'assignment', 'ss01', 'transfer', 'periods', 'daily'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source" CHECK ("tasks"."source" in ('framework', 'plan', 'assignment'));--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'assignment.manage' FROM "roles" WHERE "key" = 'head' ON CONFLICT DO NOTHING;
