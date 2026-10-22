-- Terms and their calendars (Step 13): a term's name as Rayat writes it, its first day, its weeks and
-- its status, with one active term per college; its calendar's holidays, exam weeks, grade deadlines
-- and events of the college's own; and the college's Eid breaks across the years (ADR-0018). A
-- membership gains its optional term, part of its scope. Its inverse drops memberships_term_fk and
-- the term_id column, restores memberships_scope_unique on (user_id, role_id, department_id), and
-- drops holidays, calendar_events, then terms.
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_kind" CHECK ("calendar_events"."kind" in ('holiday', 'exam', 'gradeDeadline', 'custom')),
	CONSTRAINT "calendar_events_days" CHECK ("calendar_events"."starts_on" <= "calendar_events"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"hijri_year" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"adjusted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_year_unique" UNIQUE("college_id","key","hijri_year"),
	CONSTRAINT "holidays_days" CHECK ("holidays"."starts_on" <= "holidays"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"weeks" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "terms_name_unique" UNIQUE("college_id","name"),
	CONSTRAINT "terms_status" CHECK ("terms"."status" in ('draft', 'active', 'closed')),
	CONSTRAINT "terms_weeks" CHECK ("terms"."weeks" > 0)
);
--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_scope_unique";--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "term_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_term_idx" ON "calendar_events" USING btree ("term_id","starts_on");--> statement-breakpoint
CREATE INDEX "holidays_days_idx" ON "holidays" USING btree ("college_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_one_active_idx" ON "terms" USING btree ("college_id") WHERE "terms"."status" = 'active';--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_scope_unique" UNIQUE NULLS NOT DISTINCT("user_id","role_id","department_id","term_id");