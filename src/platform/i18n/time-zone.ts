// A time zone's wall clock at an instant, as numbers, read from how Intl writes it there.
function clock(instant: number, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, Number(value)]),
  );
}

// The instant a time zone's clock reads a calendar day (YYYY-MM-DD) at a whole hour.
export function atHour(day: string, hour: number, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number);
  const wallUtc = Date.UTC(year, month - 1, date, hour);
  // How far the zone's clock is ahead of UTC at an instant.
  const offset = (instant: number) => {
    const parts = clock(instant, timeZone);
    return (
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ) - instant
    );
  };
  // Twice, so an hour on the other side of a clock change lands right.
  const guess = wallUtc - offset(wallUtc);
  return new Date(wallUtc - offset(guess));
}

// The instant a calendar day (YYYY-MM-DD) starts in a time zone: its midnight there.
export function startOfDay(day: string, timeZone: string) {
  return atHour(day, 0, timeZone);
}

// A calendar day some days after another (before, for a negative count), both YYYY-MM-DD.
export function addDays(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}

// The calendar day after another, both YYYY-MM-DD.
export function nextDay(day: string) {
  return addDays(day, 1);
}

// An instant as a time zone's clock reads it, YYYY-MM-DD HH:mm:ss: a spreadsheet takes it for a
// date and time, and its first ten characters are the day.
export function wallClock(instant: Date, timeZone: string) {
  const { year, month, day, hour, minute, second } = clock(
    instant.getTime(),
    timeZone,
  );
  const two = (value: number) => String(value).padStart(2, "0");
  return `${year}-${two(month)}-${two(day)} ${two(hour)}:${two(minute)}:${two(second)}`;
}
