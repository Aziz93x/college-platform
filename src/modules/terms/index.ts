export {
  type BreakRule,
  umAlQuraYear,
} from "./domain/holidays.ts";
export {
  type CalendarEventInput,
  type CalendarEventKind,
  calendarEventInput,
  calendarEventKinds,
  type TermStatus,
  termInput,
  termLimits,
} from "./domain/inputs.ts";
export { type ExamPeriod, examPeriodsInput } from "./domain/periods.ts";
export {
  calendarOf,
  type DayRange,
  dueDay,
  type TermCalendar,
  type TermWeek,
  termEndsOn,
  termWeeks,
  weekOf,
  weekReached,
} from "./domain/weeks.ts";
export {
  estimateHolidays,
  holidaysFrom,
  updateHoliday,
} from "./server/holidays.ts";
export {
  type ExamPeriodType,
  listExamPeriodTypes,
  saveExamPeriods,
  seedExamPeriodTypes,
} from "./server/periods.ts";
export { terms } from "./server/schema.ts";
export {
  activateTerm,
  activeTerm,
  addCalendarEvent,
  type CalendarSettings,
  calendarSettings,
  closeTerm,
  createTerm,
  findTerm,
  listTermCalendars,
  listTerms,
  openNextTerm,
  removeCalendarEvent,
  strandedBySetting,
  updateCalendarEvent,
  updateTerm,
} from "./server/terms.ts";
