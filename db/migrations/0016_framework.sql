-- The term's general framework (Step 15): its versions, a draft at most per term and the published
-- ones, which never change, with their items, each under a portfolio axis. axes gains the key the
-- items' foreign key needs, first. The colleges that exist already give their dean the new key
-- framework.endorse, as the base seed gives a new college's. Its inverse drops framework_items and
-- frameworks, the axes_college_id_id_unique constraint and the dean's framework.endorse rows.
ALTER TABLE "axes" ADD CONSTRAINT "axes_college_id_id_unique" UNIQUE("college_id","id");--> statement-breakpoint
CREATE TABLE "framework_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"framework_id" uuid NOT NULL,
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
CREATE TABLE "frameworks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"endorsed_by" uuid,
	"endorsed_at" timestamp with time zone,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frameworks_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "frameworks_version_unique" UNIQUE("term_id","version"),
	CONSTRAINT "frameworks_status" CHECK ("frameworks"."status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "framework_items" ADD CONSTRAINT "framework_items_framework_fk" FOREIGN KEY ("college_id","framework_id") REFERENCES "public"."frameworks"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_items" ADD CONSTRAINT "framework_items_axis_fk" FOREIGN KEY ("college_id","axis_id") REFERENCES "public"."axes"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frameworks" ADD CONSTRAINT "frameworks_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frameworks" ADD CONSTRAINT "frameworks_endorsed_by_users_id_fk" FOREIGN KEY ("endorsed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frameworks" ADD CONSTRAINT "frameworks_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frameworks" ADD CONSTRAINT "frameworks_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "frameworks_one_draft_idx" ON "frameworks" USING btree ("term_id") WHERE "frameworks"."status" = 'draft';
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", 'framework.endorse' FROM "roles" WHERE "key" = 'dean'
ON CONFLICT DO NOTHING;
