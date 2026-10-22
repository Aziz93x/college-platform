// Rayat's reports the platform reads (docs/PLAN.md, section 9): SS01, the sections' schedules;
// SF01, the trainees registered in them; SO01, absence by course, which a college may leave out.
export const rayatKinds = ["ss01", "sf01", "so01"] as const;
export type RayatKind = (typeof rayatKinds)[number];

// The columns of each report the platform reads, by what it reads them as; the settings
// rayat.columns.<kind> give each one's header. Every other column is dropped while the file is
// read, so SF01's trainee name, mobile number and grade never leave the reader.
export const rayatFields = {
  ss01: [
    "term",
    "department",
    "courseCode",
    "courseName",
    "creditHours",
    "sectionRef",
    "deliveryMode",
    "day",
    "time",
    "building",
    "room",
    "capacity",
    "enrolled",
    "remaining",
    "trainerNumber",
  ],
  sf01: [
    "term",
    "department",
    "courseCode",
    "sectionRef",
    "traineeNumber",
    "registrationStatus",
    "traineeStatus",
  ],
  so01: [
    "termCode",
    "term",
    "department",
    "subjectCode",
    "courseNumber",
    "traineeNumber",
    "courseStatus",
    "absencePercent",
    "absenceHours",
  ],
} as const satisfies Record<RayatKind, readonly string[]>;

export type RayatField<K extends RayatKind = RayatKind> =
  (typeof rayatFields)[K][number];

// The fields a row cannot do without. The others may be empty: a remote section has no room, a
// section may not have its trainer yet, and a status may be blank.
export const requiredFields: { [K in RayatKind]: readonly RayatField<K>[] } = {
  ss01: [
    "term",
    "department",
    "courseCode",
    "sectionRef",
    "capacity",
    "enrolled",
    "remaining",
  ],
  sf01: ["term", "department", "courseCode", "sectionRef", "traineeNumber"],
  so01: [
    "termCode",
    "term",
    "department",
    "subjectCode",
    "courseNumber",
    "traineeNumber",
  ],
};
