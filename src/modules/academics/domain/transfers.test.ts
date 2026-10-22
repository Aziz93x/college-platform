import { describe, expect, it } from "vitest";
import {
  type TaskStatus,
  trainersInWeek,
  transferStatus,
  transferTasks,
} from "./transfers.ts";

describe("trainersInWeek", () => {
  it("puts each transfer's new trainer in place of the one replaced, from its week on", () => {
    const transfers = [{ fromNumber: "200101", toNumber: "200103", week: 6 }];
    expect(trainersInWeek(["200101", "200102"], transfers, 5)).toEqual([
      "200101",
      "200102",
    ]);
    expect(trainersInWeek(["200101", "200102"], transfers, 6)).toEqual([
      "200103",
      "200102",
    ]);
  });

  it("follows a section passed on twice, by the transfers' weeks", () => {
    const transfers = [
      { fromNumber: "200103", toNumber: "200104", week: 9 },
      { fromNumber: "200101", toNumber: "200103", week: 6 },
    ];
    expect(trainersInWeek(["200101"], transfers, 8)).toEqual(["200103"]);
    expect(trainersInWeek(["200101"], transfers, 9)).toEqual(["200104"]);
  });
});

describe("transferStatus", () => {
  const transfer = {
    fromNumber: "200101",
    toNumber: "200103",
    since: new Date("2026-10-10T08:00:00Z"),
  };
  const ss01 = (appliedAt: string, trainers?: string[]) => ({
    appliedAt: new Date(appliedAt),
    trainers,
  });

  it("holds until a version of SS01 is applied after it", () => {
    expect(transferStatus(transfer, undefined)).toBe("holds");
    expect(
      transferStatus(transfer, ss01("2026-10-01T08:00:00Z", ["200101"])),
    ).toBe("holds");
  });

  it("is confirmed by a newer SS01 that names the new trainer instead of the one replaced", () => {
    expect(
      transferStatus(
        transfer,
        ss01("2026-10-12T08:00:00Z", ["200103", "200102"]),
      ),
    ).toBe("confirmed");
  });

  it("is in conflict with a newer SS01 that names anyone else, or drops the section", () => {
    for (const trainers of [
      ["200101"],
      ["200109"],
      ["200101", "200103"],
      [],
      undefined,
    ]) {
      expect(
        transferStatus(transfer, ss01("2026-10-12T08:00:00Z", trainers)),
        String(trainers),
      ).toBe("conflict");
    }
  });

  it("holds again once the head keeps it, until the next SS01", () => {
    const kept = { ...transfer, since: new Date("2026-10-13T08:00:00Z") };
    expect(transferStatus(kept, ss01("2026-10-12T08:00:00Z", ["200109"]))).toBe(
      "holds",
    );
  });
});

describe("transferTasks", () => {
  const task = (id: string, status: TaskStatus, assigneeId = "a") => ({
    id,
    status,
    assigneeId,
  });
  const transfer = { fromId: "a", toId: "c", week: 6 };

  it("moves the replaced trainer's open work to the new trainer", () => {
    expect(
      transferTasks(
        [
          task("1", "notStarted"),
          task("2", "inProgress"),
          task("3", "returned"),
        ],
        transfer,
      ),
    ).toEqual([
      task("1", "notStarted", "c"),
      task("2", "inProgress", "c"),
      task("3", "returned", "c"),
    ]);
  });

  it("leaves their completed work with them, marked until the week before the transfer", () => {
    expect(
      transferTasks(
        [task("4", "submitted"), task("5", "done"), task("6", "notApplicable")],
        transfer,
      ),
    ).toEqual([
      { ...task("4", "submitted"), untilWeek: 5 },
      { ...task("5", "done"), untilWeek: 5 },
      { ...task("6", "notApplicable"), untilWeek: 5 },
    ]);
  });

  it("does not touch another trainer's tasks", () => {
    const other = task("7", "notStarted", "b");
    expect(transferTasks([other], transfer)).toEqual([other]);
  });
});
