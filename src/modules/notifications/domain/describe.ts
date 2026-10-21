import type { Sent } from "./kinds.ts";

// The catalog's words under notifications.*, filled with values, and whether it has a key.
export type Words = ((
  key: string,
  values?: Record<string, unknown>,
) => string) & {
  has: (key: string) => boolean;
};

export type NotificationText = { title: string; description?: string };

// What a notification says: its kind's title and, where the catalog has one, its description,
// filled with what it was sent with. A digest names the notifications it counts by their own titles.
// A kind the catalog has no words for, sent by a later version, says the general words.
export function describeNotification(
  sent: Sent,
  words: Words,
  list: (items: string[]) => string,
): NotificationText {
  const key = `kinds.${sent.kind}`;
  if (!words.has(`${key}.title`)) return { title: words("unknown") };
  if (sent.kind === "weeklyDigest") {
    const { count, latest } = sent.params as { count: number; latest: Sent[] };
    const named = latest.map(
      (item) => describeNotification(item, words, list).title,
    );
    return {
      title: words(`${key}.title`, { count }),
      description: words(`${key}.description`, {
        latest: list(named),
        more: count - named.length,
      }),
    };
  }
  return {
    title: words(`${key}.title`, sent.params),
    description: words.has(`${key}.description`)
      ? words(`${key}.description`, sent.params)
      : undefined,
  };
}
