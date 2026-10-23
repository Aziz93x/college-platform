import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { colleges } from "../../org/index.ts";
import type { CalendarEventKind, TermStatus } from "../domain/inputs.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// A term of the college as the vice-dean enters it (Step 13): its name as Rayat writes it, its
// first day and its number of weeks. Every date of the work derives from it and its calendar. A
// college has one active term at most; a closed term keeps its rows for what was built on it. A row
// that points at a term names the college too, and (college_id, id) must be one term's.
export const terms = pgTable(
  "terms",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    name: text().notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    weeks: integer().notNull(),
    status: text().$type<TermStatus>().notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("terms_college_id_id_unique").on(table.collegeId, table.id),
    unique("terms_name_unique").on(table.collegeId, table.name),
    uniqueIndex("terms_one_active_idx")
      .on(table.collegeId)
      .where(sql`${table.status} = 'active'`),
    check(
      "terms_status",
      sql`${table.status} in ('draft', 'active', 'closed')`,
    ),
    check("terms_weeks", sql`${table.weeks} > 0`),
  ],
);

// A day or days of a term's calendar. Its holidays decide which weeks the term counts
// (domain/weeks.ts).
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    kind: text().$type<CalendarEventKind>().notNull(),
    title: text().notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "calendar_events_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    index("calendar_events_term_idx").on(table.termId, table.startsOn),
    check(
      "calendar_events_kind",
      sql`${table.kind} in ('holiday', 'gradeDeadline', 'custom')`,
    ),
    check("calendar_events_days", sql`${table.startsOn} <= ${table.endsOn}`),
  ],
);

// The college's Eid breaks across the years (ADR-0018): each year's, by the key of the rule it was
// estimated from, until the vice-dean adjusts it. Every term counts those that fall in it as its
// holidays. Its name is data, from the base seed.
export const holidays = pgTable(
  "holidays",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    key: text().notNull(),
    name: text().notNull(),
    hijriYear: integer("hijri_year").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    // Whether the vice-dean has set its days, rather than the estimate.
    adjusted: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("holidays_year_unique").on(
      table.collegeId,
      table.key,
      table.hijriYear,
    ),
    index("holidays_days_idx").on(table.collegeId, table.startsOn),
    check("holidays_days", sql`${table.startsOn} <= ${table.endsOn}`),
  ],
);

// The college's catalog of exam-period types (the owner's notes, 21 October 2026): each with its
// name and short name, in order. They are data, seeded by the base seed; a term's periods and the
// due rules anchored to them name a type by its code. No screen changes them yet.
export const examPeriodTypes = pgTable(
  "exam_period_types",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    code: text().notNull(),
    name: text().notNull(),
    shortName: text("short_name").notNull(),
    position: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("exam_period_types_code_unique").on(table.collegeId, table.code),
  ],
);

// A term's exam period of a type, from a week to a week by their numbers, as the vice-dean sets it:
// one of each type at most. The weeks may pass the term's end once the term is shortened, which
// the term's page shows as an error until the vice-dean moves the period (domain/periods.ts).
export const examPeriods = pgTable(
  "exam_periods",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    type: text().notNull(),
    fromWeek: integer("from_week").notNull(),
    toWeek: integer("to_week").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "exam_periods_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "exam_periods_type_fk",
      columns: [table.collegeId, table.type],
      foreignColumns: [examPeriodTypes.collegeId, examPeriodTypes.code],
    }),
    unique("exam_periods_type_unique").on(table.termId, table.type),
    check(
      "exam_periods_weeks",
      sql`1 <= ${table.fromWeek} and ${table.fromWeek} <= ${table.toWeek}`,
    ),
  ],
);
