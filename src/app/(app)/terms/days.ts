// A term's days as its pages write them: in the college's locale and digits, on the calendar's own
// day (read on UTC's clock, so no time zone moves it), with the Umm al-Qura dates beside them where
// the locale.hijri setting asks (docs/PLAN.md, the note from Step 7 under Step 13).
export function dayWords(locale: string, hijri: boolean) {
  const at = (day: string) => new Date(`${day}T00:00:00Z`);
  const gregorian = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const withYear = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const umAlQura = new Intl.DateTimeFormat(locale, {
    calendar: "islamic-umalqura",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const span = (format: Intl.DateTimeFormat, from: string, to: string) =>
    from === to ? format.format(at(from)) : format.formatRange(at(from), at(to));
  return {
    /** A day with its year, as a term's first and last are written. */
    day: (day: string) => withYear.format(at(day)),
    /** Days from one to another, or one day. */
    span: (from: string, to: string) => span(gregorian, from, to),
    /** The same days on the Umm al-Qura calendar, where the college shows it. */
    hijri: hijri
      ? (from: string, to: string) => span(umAlQura, from, to)
      : undefined,
  };
}
