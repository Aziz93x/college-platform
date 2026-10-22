export {
  type CalendarEventInput,
  type CalendarEventKind,
  calendarEventInput,
  calendarEventKinds,
  type TermInput,
  type TermStatus,
  termInput,
  termLimits,
} from "./domain/inputs.ts";
export {
  type Day,
  type TermCalendar,
  type TermWeek,
  termEndsOn,
  termWeeks,
  weekOf,
} from "./domain/weeks.ts";
export { calendarEvents, terms } from "./server/schema.ts";
export {
  activateTerm,
  activeTerm,
  addCalendarEvent,
  type CalendarEvent,
  type CalendarSettings,
  calendarOf,
  calendarSettings,
  closeTerm,
  createTerm,
  findTerm,
  listTerms,
  openNextTerm,
  removeCalendarEvent,
  type Term,
  updateCalendarEvent,
  updateTerm,
} from "./server/terms.ts";
