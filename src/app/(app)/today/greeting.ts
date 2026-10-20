// Morning until noon on the college's clock, evening after it.
export function greetingPeriod(now: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
  return hour < 12 ? "morning" : "evening";
}
