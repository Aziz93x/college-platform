-- Exam periods by week number and the due rule anchored to them (the owner's notes, 21 October
-- 2026; ADR-0026). The college's types of exam period are a catalog the base seed fills; a term's
-- periods name a type by its code, from a week to a week. An exam is no longer a dated event of the
-- calendar: each one already there becomes an event of the college's own with its title and days,
-- as its weeks cannot be read in SQL past the college's breaks, and the vice-dean sets the term's
-- periods. A rule "after each day of a kind" becomes "after each exam period" by the same weeks,
-- naming the base seed's four types: exactly so for "after each exam", and the nearest rule for a
-- kind of day no item has asked for. A pass of the generation engine gains its cause "periods".
-- Its inverse turns each anchored rule back into one after each exam week by its weeks, deletes the
-- passes the periods caused, drops exam_periods and exam_period_types, and puts back both checks;
-- the exams it made events of the college's own stay so.
CREATE TABLE "exam_period_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_period_types_code_unique" UNIQUE("college_id","code")
);
--> statement-breakpoint
CREATE TABLE "exam_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_week" integer NOT NULL,
	"to_week" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_periods_type_unique" UNIQUE("term_id","type"),
	CONSTRAINT "exam_periods_weeks" CHECK (1 <= "exam_periods"."from_week" and "exam_periods"."from_week" <= "exam_periods"."to_week")
);
--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_reason";--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_kind";--> statement-breakpoint
UPDATE "calendar_events" SET "kind" = 'custom', "updated_at" = now() WHERE "kind" = 'exam';--> statement-breakpoint
UPDATE "framework_items" SET "due" = jsonb_build_object('type', 'examPeriods', 'periodTypes', '["first-periodic", "second-periodic", "practical-final", "theoretical-final"]'::jsonb, 'side', 'after', 'weeks', "due"->'weeks'), "updated_at" = now() WHERE "due"->>'type' = 'afterEvent';--> statement-breakpoint
UPDATE "section_templates" SET "due" = jsonb_build_object('type', 'examPeriods', 'periodTypes', '["first-periodic", "second-periodic", "practical-final", "theoretical-final"]'::jsonb, 'side', 'after', 'weeks', "due"->'weeks'), "updated_at" = now() WHERE "due"->>'type' = 'afterEvent';--> statement-breakpoint
ALTER TABLE "exam_period_types" ADD CONSTRAINT "exam_period_types_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_periods" ADD CONSTRAINT "exam_periods_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_periods" ADD CONSTRAINT "exam_periods_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_periods" ADD CONSTRAINT "exam_periods_type_fk" FOREIGN KEY ("college_id","type") REFERENCES "public"."exam_period_types"("college_id","code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_reason" CHECK ("generation_runs"."reason" in ('framework', 'ss01', 'transfer', 'periods', 'daily'));--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_kind" CHECK ("calendar_events"."kind" in ('holiday', 'gradeDeadline', 'custom'));