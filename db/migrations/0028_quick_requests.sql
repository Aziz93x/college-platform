-- Quick requests and the term readiness board (Step 22): an urgent request sent without the plan
-- editor, whose tasks are a source of their own ("request") that the generation engine makes at once
-- (ADR-0025), and "request" as a pass's cause. The heads, the vice-dean and the dean get the keys
-- requests.send and readiness.view, as the base seed gives them. Its inverse deletes the tasks and
-- passes the requests caused, puts back both checks without "request", drops quick_requests, and
-- takes the two keys from the three roles.
CREATE TABLE "quick_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid,
	"title" text NOT NULL,
	"axis_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"targets" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_reason";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_source";--> statement-breakpoint
ALTER TABLE "quick_requests" ADD CONSTRAINT "quick_requests_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_requests" ADD CONSTRAINT "quick_requests_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_requests" ADD CONSTRAINT "quick_requests_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_requests" ADD CONSTRAINT "quick_requests_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_requests" ADD CONSTRAINT "quick_requests_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quick_requests_term_idx" ON "quick_requests" USING btree ("term_id","created_at");--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'plan', 'assignment', 'request', 'ss01', 'transfer', 'periods', 'daily', 'admin'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source" CHECK ("tasks"."source" in ('framework', 'plan', 'assignment', 'request'));--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'requests.send' FROM "roles" WHERE "key" IN ('head', 'vice-dean', 'dean') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'readiness.view' FROM "roles" WHERE "key" IN ('head', 'vice-dean', 'dean') ON CONFLICT DO NOTHING;
