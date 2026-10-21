import { describe, expect, it } from "vitest";
import { describeNotification, type Words } from "./describe.ts";

// A catalog of three kinds; a word shows its key and the values it was filled with.
const catalog: Record<string, true> = {
  unknown: true,
  "kinds.membershipAdded.title": true,
  "kinds.membershipAdded.description": true,
  "kinds.membershipRemoved.title": true,
  "kinds.weeklyDigest.title": true,
  "kinds.weeklyDigest.description": true,
};
const words = Object.assign(
  (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  { has: (key: string) => key in catalog },
) satisfies Words;
const list = (items: string[]) => items.join(" + ");

const added = {
  kind: "membershipAdded",
  params: {
    role: "المدرب",
    scope: "department",
    department: "التقنية الكهربائية",
  },
};

describe("describeNotification", () => {
  it("fills the kind's title and description with what it was sent with", () => {
    expect(describeNotification(added, words, list)).toEqual({
      title: `kinds.membershipAdded.title ${JSON.stringify(added.params)}`,
      description: `kinds.membershipAdded.description ${JSON.stringify(added.params)}`,
    });
  });

  it("leaves out a description the catalog does not have", () => {
    const removed = { kind: "membershipRemoved", params: added.params };
    expect(describeNotification(removed, words, list).description).toBe(
      undefined,
    );
  });

  it("names the notifications a digest counts by their own titles, and counts the rest", () => {
    const digest = {
      kind: "weeklyDigest",
      params: {
        count: 5,
        latest: [added, { kind: "membershipRemoved", params: { role: "x" } }],
      },
    };
    expect(describeNotification(digest, words, list)).toEqual({
      title: 'kinds.weeklyDigest.title {"count":5}',
      description: `kinds.weeklyDigest.description ${JSON.stringify({
        latest: `kinds.membershipAdded.title ${JSON.stringify(added.params)} + kinds.membershipRemoved.title {"role":"x"}`,
        more: 3,
      })}`,
    });
  });

  it("says the general words for a kind the catalog has no words for", () => {
    expect(
      describeNotification({ kind: "taskReturned", params: {} }, words, list),
    ).toEqual({ title: "unknown" });
  });
});
