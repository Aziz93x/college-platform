const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// The college's session settings, read per request.
export type SessionLimits = {
  idleMinutes: number;
  sessionHours: number;
  rememberedDeviceDays: number;
};

type SessionTimes = {
  remembered: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
};

// When the session ends under the college's settings, never later than Better Auth's own expiry.
// A remembered device stays signed in for its days; any other session ends after its hours, or
// sooner after the idle time without a request.
export function sessionEnd(session: SessionTimes, limits: SessionLimits) {
  const created = session.createdAt.getTime();
  const ends = session.remembered
    ? [created + limits.rememberedDeviceDays * DAY_MS]
    : [
        created + limits.sessionHours * HOUR_MS,
        session.lastSeenAt.getTime() + limits.idleMinutes * MINUTE_MS,
      ];
  return new Date(Math.min(session.expiresAt.getTime(), ...ends));
}

// The last-seen time is written at most once a minute, so a busy session costs few writes.
export function isLastSeenStale(lastSeenAt: Date, now: Date) {
  return now.getTime() - lastSeenAt.getTime() >= MINUTE_MS;
}
