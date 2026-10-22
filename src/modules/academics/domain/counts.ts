// What each department's sections give the items for their trainers (Step 15), from SS01's
// records: a task for each trainer of each section, or for each trainer of each course once for
// all their sections of it, and none for a section with no trainer yet, which the preview names
// apart (the owner's rule, lead review C).
export function trainerCounts(
  records: readonly {
    departmentId: string;
    courseCode: string;
    trainerNumbers: readonly string[];
  }[],
) {
  const counts: Record<
    string,
    { trainers: number; untaught: number; courses: number }
  > = {};
  const taught: Record<string, Set<string>> = {};
  for (const { departmentId, courseCode, trainerNumbers } of records) {
    counts[departmentId] ??= { trainers: 0, untaught: 0, courses: 0 };
    taught[departmentId] ??= new Set();
    const count = counts[departmentId];
    const trainers = new Set(trainerNumbers);
    count.trainers += trainers.size;
    if (trainers.size === 0) count.untaught += 1;
    for (const number of trainers) {
      taught[departmentId].add(JSON.stringify([courseCode, number]));
    }
    count.courses = taught[departmentId].size;
  }
  return counts;
}
