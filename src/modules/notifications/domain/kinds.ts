// What the platform tells a person about is code: each kind, the page it opens (or how its params
// name it), whether its people may turn it off, and what its message is filled with. The words are data,
// notifications.kinds.<kind> in messages/*.json, whose variables are the kind's params. A step that
// tells people something new adds its kind here.
const notificationKinds = {
  // A role given to the person, across the college or in a department (Steps 9 and 10).
  membershipAdded: { href: "/profile", optional: true },
  // A role taken from them.
  membershipRemoved: { href: "/profile", optional: true },
  // The week's summary, on the college's digest day and hour (Steps 12 and 27).
  weeklyDigest: { href: "/notifications", optional: true },
  // What someone announced to the person's department or college, shown over the page until it is
  // closed, which no one turns off (ADR-0017).
  announcement: { href: "/notifications", optional: false },
  // A new version of SS01 put a transfer of a section of the head's department in conflict, or left
  // it replacing a trainer who no longer teaches the section (ADR-0020).
  transferConflict: { href: "/sections", optional: true },
  // A quick request that gave the person a task (Step 22).
  quickRequest: { href: "/today", optional: true },
  // A responsibility of a term, open on the readiness board, that someone reminded its owner of;
  // it opens the page that settles it on that term, as choosing it in the header does (lead review
  // D, proposal 5).
  readinessReminder: {
    href: ({ href, termId }: NotificationParams["readinessReminder"]) =>
      `/switch-term/${termId}?next=${encodeURIComponent(href)}`,
    optional: true,
  },
} as const;

export type NotificationKind = keyof typeof notificationKinds;

export const notificationKindKeys = Object.keys(
  notificationKinds,
) as NotificationKind[];

export function isNotificationKind(value: string): value is NotificationKind {
  return Object.hasOwn(notificationKinds, value);
}

// Whether a person may turn a kind off.
export function isOptional(kind: NotificationKind) {
  return notificationKinds[kind].optional;
}

// The page a notification opens: its kind's, or the one its params name.
export function notificationPage(
  kind: NotificationKind,
  params: Record<string, unknown>,
) {
  const { href } = notificationKinds[kind];
  return typeof href === "string" ? href : href(params as never);
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
  // How many notifications of the week are still unread, the newest of them, and which they are
  // (ADR-0015; a digest sent before it has no ids).
  weeklyDigest: { count: number; latest: Sent[]; ids: string[] };
  // The announcement, its words and who made it, as they were when it was sent.
  announcement: {
    announcementId: string;
    title: string;
    body: string;
    author: string;
  } & ({ scope: "college" } | { scope: "department"; department: string });
  // The section, its department as named when it was sent, and what Rayat now says of the transfer.
  transferConflict: {
    sectionRef: string;
    department: string;
    status: "conflict" | "otherTrainer";
  };
  // The request's title, the day it is due in words and who sent it, as they were when it was sent.
  quickRequest: { requestId: string; title: string; due: string; from: string };
  // The board's row as it read when the reminder was sent, who sent it, the row's page, and its
  // term with its name then.
  readinessReminder: {
    title: string;
    detail: string;
    from: string;
    href: string;
    termId: string;
    term: string;
  };
};
