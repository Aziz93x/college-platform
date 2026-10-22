import { describe, expect, it } from "vitest";
import { readTransfers } from "./transfers.ts";

describe("readTransfers", () => {
  // Rayat's file, and transfers made before it was uploaded and after.
  const uploadedAt = new Date("2026-10-10T08:00:00Z");
  const before = new Date("2026-10-05T08:00:00Z");
  const after = new Date("2026-10-12T08:00:00Z");
  const transfer = (
    fromNumber: string,
    toNumber: string,
    week: number,
    since = after,
  ) => ({ fromNumber, toNumber, week, since });

  it("puts each transfer's new trainer in place of the one replaced, from its week on", () => {
    const read = readTransfers(["200101", "200102"], uploadedAt, [
      transfer("200101", "200103", 6),
    ]);
    expect(read.statuses).toEqual(["holds"]);
    expect(read.trainersInWeek(5)).toEqual(["200101", "200102"]);
    expect(read.trainersInWeek(6)).toEqual(["200103", "200102"]);
  });

  it("follows a section passed on twice, by the transfers' weeks", () => {
    const read = readTransfers(["200101"], uploadedAt, [
      transfer("200103", "200104", 9),
      transfer("200101", "200103", 6),
    ]);
    expect(read.statuses).toEqual(["holds", "holds"]);
    expect(read.trainersInWeek(8)).toEqual(["200103"]);
    expect(read.trainersInWeek(9)).toEqual(["200104"]);
  });

  it("holds while Rayat's file was uploaded before it was made, though it is applied after", () => {
    const read = readTransfers(["200101"], uploadedAt, [
      transfer("200101", "200103", 6, after),
    ]);
    expect(read.statuses).toEqual(["holds"]);
  });

  it("is confirmed by Rayat naming the new trainer and not the one replaced, and leaves the weeks before it to the replaced trainer", () => {
    const read = readTransfers(["200103", "200102"], uploadedAt, [
      transfer("200101", "200103", 6, before),
    ]);
    expect(read.statuses).toEqual(["confirmed"]);
    expect(read.trainersInWeek(3)).toEqual(["200101", "200102"]);
    expect(read.trainersInWeek(6)).toEqual(["200103", "200102"]);
  });

  it("is confirmed along a section passed on twice, once Rayat names its last trainer", () => {
    const read = readTransfers(["200104"], uploadedAt, [
      transfer("200101", "200103", 6, before),
      transfer("200103", "200104", 9, before),
    ]);
    expect(read.statuses).toEqual(["confirmed", "confirmed"]);
    expect(read.trainersInWeek(5)).toEqual(["200101"]);
    expect(read.trainersInWeek(8)).toEqual(["200103"]);
    expect(read.trainersInWeek(9)).toEqual(["200104"]);
  });

  it("is in conflict with a file uploaded after it that still names the replaced trainer, and applies until the head keeps or cancels it", () => {
    for (const rayat of [["200101"], ["200101", "200103"]]) {
      const read = readTransfers(rayat, uploadedAt, [
        transfer("200101", "200103", 6, before),
      ]);
      expect(read.statuses, String(rayat)).toEqual(["conflict"]);
      expect(read.trainersInWeek(5), String(rayat)).toEqual(rayat);
      expect(read.trainersInWeek(6), String(rayat)).toEqual(["200103"]);
    }
  });

  it("holds again once the head keeps it, until the next file", () => {
    const kept = transfer("200101", "200103", 6, after);
    expect(readTransfers(["200101"], uploadedAt, [kept]).statuses).toEqual([
      "holds",
    ]);
  });

  it("changes nothing once Rayat no longer names the trainer it replaced, kept or not, the section's trainers gone too", () => {
    for (const since of [before, after]) {
      for (const rayat of [["200109"], []]) {
        const read = readTransfers(rayat, uploadedAt, [
          transfer("200101", "200103", 6, since),
        ]);
        expect(read.statuses, `${rayat} ${since}`).toEqual(["otherTrainer"]);
        expect(read.trainersInWeek(9), `${rayat} ${since}`).toEqual(rayat);
      }
    }
  });

  it("changes nothing once an earlier transfer has replaced the same trainer", () => {
    const read = readTransfers(["200101"], uploadedAt, [
      transfer("200101", "200104", 9),
      transfer("200101", "200103", 6),
    ]);
    expect(read.statuses).toEqual(["otherTrainer", "holds"]);
    expect(read.trainersInWeek(9)).toEqual(["200103"]);
  });

  it("keeps a confirmed transfer in the place Rayat gave it, after an earlier transfer of the same trainer made since", () => {
    const read = readTransfers(["200104"], uploadedAt, [
      transfer("200101", "200104", 9, before),
      transfer("200101", "200103", 6, after),
    ]);
    expect(read.statuses).toEqual(["confirmed", "holds"]);
    expect(read.trainersInWeek(5)).toEqual(["200101"]);
    expect(read.trainersInWeek(6)).toEqual(["200103"]);
    expect(read.trainersInWeek(9)).toEqual(["200104"]);
  });

  it("keeps each place by the trainer who held it at the term's start, whoever holds it in a week", () => {
    const read = readTransfers(["200101", "200102"], uploadedAt, [
      transfer("200101", "200103", 6),
      transfer("200103", "200104", 9),
    ]);
    expect(read.places(5)).toEqual([
      { first: "200101", holder: "200101" },
      { first: "200102", holder: "200102" },
    ]);
    expect(read.places(9)).toEqual([
      { first: "200101", holder: "200104" },
      { first: "200102", holder: "200102" },
    ]);
  });

  it("names a place after the trainer a confirmed transfer replaced, as before Rayat's file", () => {
    const read = readTransfers(["200103"], uploadedAt, [
      transfer("200101", "200103", 6, before),
    ]);
    expect(read.places(3)).toEqual([{ first: "200101", holder: "200101" }]);
    expect(read.places(6)).toEqual([{ first: "200101", holder: "200103" }]);
  });
});
