// What the platform tells a person about is code: each kind, the page it opens and what its message
// is filled with. The words are data, notifications.kinds.<kind> in messages/*.json, whose
// variables are the kind's params. A step that tells people something new adds its kind here.
export const notificationKinds = {
  // A role given to the person, across the college or in a department (Steps 9 and 10).
  membershipAdded: { href: "/profile" },
  // A role taken from them.
  membershipRemoved: { href: "/profile" },
  // The week's summary, on the college's digest day and hour (Steps 12 and 27).
  weeklyDigest: { href: "/notifications" },
} as const;

export type NotificationKind = keyof typeof notificationKinds;

export const notificationKindKeys = Object.keys(
  notificationKinds,
) as NotificationKind[];

export function isNotificationKind(value: string): value is NotificationKind {
  return Object.hasOwn(notificationKinds, value);
}

// A role and where it is held, named as they were when the message was sent.
type Held = { role: string } & (
  | { scope: "college" }
  | { scope: "department"; department: string }
);

// A notification as the digest names it again: its kind and what it was sent with.
export type Sent = { kind: string; params: Record<string, unknown> };

export type NotificationParams = {
  membershipAdded: Held;
  membershipRemoved: Held;
  // How many notifications of the week are still unread, and the newest of them.
  weeklyDigest: { count: number; latest: Sent[] };
};
