-- A head's section templates for a term (Step 18): the department's items for each trainer of each
-- of its sections, drafts until the department's plan is published, which the head edits with
-- plan.edit. Its inverse drops section_templates and takes plan.edit from the head.
CREATE TABLE "section_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"axis_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"due" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "section_templates" ADD CONSTRAINT "section_templates_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_templates" ADD CONSTRAINT "section_templates_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_templates" ADD CONSTRAINT "section_templates_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_templates" ADD CONSTRAINT "section_templates_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "section_templates_term_idx" ON "section_templates" USING btree ("term_id","department_id","position");--> statement-breakpoint
-- The head's plan.edit for colleges seeded while the key was out (docs/PLAN.md, section 0): the base seed gives a role its keys only when it creates the role (Audit 3).
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'plan.edit' FROM "roles" WHERE "key" = 'head' ON CONFLICT DO NOTHING;
