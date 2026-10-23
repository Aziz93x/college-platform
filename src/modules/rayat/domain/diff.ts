import { canonical } from "../../../platform/validation/text.ts";
import { identity, type RayatRecords, recordKey, recordKeys } from "./check.ts";
import type { RayatKind } from "./reports.ts";

// How many records of each change a diff names to show; its counts are whole. A guard on what an
// import keeps of its diff, not a policy anyone sets.
export const DIFF_SAMPLES = 50;

// What an import changes in the records of the version before it, matched by their keys: records
// added, removed, changed (with the fields that changed) and left as they were.
export type RayatDiff = {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  samples: {
    added: string[][];
    removed: string[][];
    changed: { key: string[]; fields: string[] }[];
  };
};

export function diffRecords<K extends RayatKind>(
  kind: K,
  before: readonly RayatRecords[K][],
  after: readonly RayatRecords[K][],
): RayatDiff {
  const keys: readonly string[] = recordKeys[kind];
  const previous = new Map(
    before.map((record) => [identity(kind, record), record]),
  );
  const diff: RayatDiff = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    samples: { added: [], removed: [], changed: [] },
  };
  for (const record of after) {
    const id = identity(kind, record);
    const old = previous.get(id);
    previous.delete(id);
    if (!old) {
      diff.added += 1;
      if (diff.samples.added.length < DIFF_SAMPLES) {
        diff.samples.added.push(recordKey(kind, record));
      }
      continue;
    }
    const fields = Object.keys(record).filter(
      (field) =>
        !keys.includes(field) &&
        canonical(record[field as keyof typeof record]) !==
          canonical(old[field as keyof typeof old]),
    );
    if (fields.length === 0) {
      diff.unchanged += 1;
      continue;
    }
    diff.changed += 1;
    if (diff.samples.changed.length < DIFF_SAMPLES) {
      diff.samples.changed.push({ key: recordKey(kind, record), fields });
    }
  }
  for (const old of previous.values()) {
    diff.removed += 1;
    if (diff.samples.removed.length < DIFF_SAMPLES) {
      diff.samples.removed.push(recordKey(kind, old));
    }
  }
  return diff;
}
