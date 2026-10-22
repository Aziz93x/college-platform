import { and, eq } from "drizzle-orm";
import {
  listDirectory,
  listRoles,
  roles,
  setRolePermissions,
} from "../../../src/modules/access/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  applyRayat,
  type RayatKind,
  rayatImports,
  uploadRayat,
} from "../../../src/modules/rayat/index.ts";
import { activeTerm, umAlQuraYear } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { rayatColumns, rayatHeaders } from "../rayat-columns.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

// Each demo department's courses, by its order in demoDepartments, with the letters Rayat's course
// codes start with.
const CATALOG = [
  {
    letters: "عام",
    courses: [
      "اللغة الإنجليزية 1",
      "الرياضيات العامة",
      "الفيزياء العامة",
      "الكتابة الفنية",
      "السلوك الوظيفي ومهارات الاتصال",
    ],
  },
  {
    letters: "كهر",
    courses: [
      "الدوائر الكهربائية",
      "القياسات الكهربائية",
      "الآلات الكهربائية",
      "التمديدات الكهربائية",
      "الإلكترونيات الصناعية",
      "التحكم المنطقي المبرمج",
    ],
  },
  {
    letters: "ميك",
    courses: [
      "الرسم الفني",
      "ورش التشغيل",
      "المحركات",
      "التبريد والتكييف",
      "الهيدروليك والنيوماتيك",
    ],
  },
];

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const TIMES = ["08:00 - 09:40", "10:00 - 11:40", "12:30 - 14:10"];
const TRAINEE_NAMES = [
  ["عبدالرحمن", "مشاري", "ريان", "زياد", "حمد", "وليد", "أنس", "رائد"],
  ["القحطاني", "الزهراني", "المالكي", "العصيمي", "الحارثي", "الشهري"],
];
// The trainees each department registers: enough for two full sections of a course.
const TRAINEES = 64;

export type DemoRayatDepartment = {
  // The department as Rayat writes it, one of its values.
  rayatValue: string;
  trainers: { employeeNumber: string; name: string }[];
};

// Synthetic SS01, SF01 and SO01 tables for a term as Rayat exports them, every column filled,
// trainees' names, mobile numbers and grades included: the import drops them. Each course has two
// sections that meet on two days, an eighth of them remote; a section now and then has more
// trainees than seats; SF01 registers each section's trainees, a few dropped or withdrawn; SO01
// gives some of them unexcused absence, barring those past a quarter of the course's hours. In the
// third department, the first course's second section is taught by two trainers, one each day, and
// the last course's second section has no trainer yet (lead review C).
export function demoRayatFiles(
  random: () => number,
  term: { name: string; code: string },
  departments: readonly DemoRayatDepartment[],
): Record<RayatKind, string[][]> {
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)];
  const between = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1));
  const shuffled = <T>(list: readonly T[]) => {
    const copy = [...list];
    for (let at = copy.length - 1; at > 0; at--) {
      const other = Math.floor(random() * (at + 1));
      [copy[at], copy[other]] = [copy[other], copy[at]];
    }
    return copy;
  };
  const files: Record<RayatKind, string[][]> = {
    ss01: [rayatHeaders.ss01],
    sf01: [rayatHeaders.sf01],
    so01: [rayatHeaders.so01],
  };
  // A row in the export's order: the columns read, by field, and the others, by header.
  const add = <K extends RayatKind>(
    kind: K,
    read: Record<keyof (typeof rayatColumns)[K], string | number>,
    dropped: Record<string, string | number>,
  ) => {
    const columns = rayatColumns[kind] as Record<string, string>;
    const values = new Map<string, string>(
      Object.entries(dropped).map(([header, value]) => [header, String(value)]),
    );
    for (const [field, value] of Object.entries(read)) {
      values.set(columns[field], String(value));
    }
    files[kind].push(
      rayatHeaders[kind].map((header) => values.get(header) ?? ""),
    );
  };

  let sectionRef = 30101;
  let traineeNumber = 444100001;
  for (const [index, department] of departments.entries()) {
    const { letters, courses } = CATALOG[index % CATALOG.length];
    const trainees = Array.from({ length: TRAINEES }, () => ({
      number: String(traineeNumber++),
      name: `${pick(TRAINEE_NAMES[0])} ${pick(TRAINEE_NAMES[1])}`,
      mobile: `05${between(10000000, 99999999)}`,
    }));
    for (const [position, courseName] of courses.entries()) {
      const courseNumber = String(101 + position * 10);
      const courseCode = `${letters} ${courseNumber}`;
      const hours = between(2, 4);
      // The course's trainees in a new order: the first section takes the first, the second the next.
      const order = shuffled(trainees);
      let taken = 0;
      for (let section = 0; section < 2; section++) {
        const ref = String(sectionRef++);
        const remote = random() < 0.125;
        const capacity = pick([25, 30]);
        const enrolled = Math.min(
          between(capacity - 9, capacity) + (random() < 0.08 ? 2 : 0),
          TRAINEES / 2,
        );
        const trainer =
          department.trainers[
            (position * 2 + section) % department.trainers.length
          ];
        // The second day's trainer: another for a co-taught section, none for one without a trainer.
        const third = index === 2 && section === 1;
        const untaught = third && position === courses.length - 1;
        const second =
          third && position === 0
            ? department.trainers[
                (position * 2 + section + 1) % department.trainers.length
              ]
            : trainer;
        const first = between(0, DAYS.length - 3);
        const time = pick(TIMES);
        const shared = {
          term: term.name,
          department: department.rayatValue,
          courseCode,
          courseName,
          creditHours: hours,
          sectionRef: ref,
          deliveryMode: remote ? "عن بعد" : "حضوري",
          capacity,
          enrolled,
          remaining: capacity - enrolled,
        };
        for (const [day, teacher] of [
          [DAYS[first], trainer],
          [DAYS[first + 2], second],
        ] as const) {
          add(
            "ss01",
            {
              ...shared,
              trainerNumber: untaught ? "" : teacher.employeeNumber,
              day,
              time,
              building: remote ? "" : `المبنى ${index + 1}`,
              room: remote ? "" : String(between(101, 124) + 100 * section),
            },
            {
              "الوحدة التدريبية": "الكلية التقنية",
              "جزء الفصل": 1,
              "ساعات المحاسبة": hours,
              "ساعات المحاضرة": hours - 1,
              "ساعات المختبر": 2,
              "ساعات أخرى": 0,
              "ساعات الاتصال": hours + 1,
              "نوع الشعبة": "عادية",
              "كل من الاستجابة الصوتية والخدمة الذاتية متاح": "نعم",
              "الحد الأقصى للمقاعد المحجوزة": 0,
              "المحجوزة بالفعل": 0,
              "المحجوزة المتبقية": 0,
              "الحد الأقصى للائحة الانتظار": 0,
              "المسجلون على لائحة الانتظار": 0,
              "المتبقي على لائحة الانتظار": 0,
              "اسم المدرب": untaught ? "" : teacher.name,
            },
          );
        }
        for (const trainee of order.slice(taken, taken + enrolled)) {
          const left = random();
          add(
            "sf01",
            {
              term: term.name,
              department: department.rayatValue,
              courseCode,
              sectionRef: ref,
              traineeNumber: trainee.number,
              registrationStatus:
                left < 0.04 ? "محذوف" : left < 0.07 ? "منسحب" : "مسجل",
              traineeStatus: left < 0.07 ? "منقطع" : "منتظم",
            },
            {
              الوحدة: "الكلية التقنية",
              المرحلة: "الدبلوم",
              التخصص: department.rayatValue,
              "اسم المقرر": courseName,
              "نوع الجدولة": shared.deliveryMode,
              "الساعات المعتمدة": hours,
              المدرب: trainer.name,
              "إسم المتدرب": trainee.name,
              مرحلة: "الدبلوم",
              "نوع التدريب": "صباحي",
              برنامج: "الدبلوم التقني",
              "رقم الجوال": trainee.mobile,
              الدرجة: between(55, 100),
            },
          );
          if (random() < 0.3) {
            const absent = between(1, Math.round(hours * 16 * 0.27));
            const percent = Math.round((absent / (hours * 16)) * 10000) / 100;
            add(
              "so01",
              {
                termCode: term.code,
                term: term.name,
                department: department.rayatValue,
                subjectCode: letters,
                courseNumber,
                traineeNumber: trainee.number,
                courseStatus: percent >= 25 ? "محروم" : "منتظم",
                absencePercent: percent,
                absenceHours: absent,
              },
              {},
            );
          }
        }
        taken += enrolled;
      }
    }
  }
  return files;
}

// A trainer Electrical's SS01 names who is not on the platform yet, a visitor whose sections the
// unmatched report lists (Step 17).
export const demoVisitor = {
  employeeNumber: "209001",
  name: "مدرب زائر",
  department: demoDepartments[1].name,
};

// The demo term's three reports (Step 16), uploaded by the vice-dean and the head of Electrical
// and applied by the vice-dean, and a newer SF01 the head uploaded, waiting to be applied: a few
// trainees withdrawn and two registered late, the diff to review. The head imports because the
// admin gave the head's role the key on the roles page (ADR-0019). Written once, while the term has
// no import. Gives the SS01 Rayat exports next, a trainee more in the first section, which
// seedDemoSections() applies after a head's transfer that it does not know of (ADR-0020).
export async function seedDemoRayat(
  { db, random }: { db: Db; random: () => number },
  collegeId: string,
) {
  const term = await activeTerm(collegeId, db);
  if (!term) throw new Error("seed:demo: the demo term is missing");
  const [made] = await db
    .select({ id: rayatImports.id })
    .from(rayatImports)
    .where(eq(rayatImports.termId, term.id))
    .limit(1);
  if (made) return undefined;

  const changeBy = async ({ email }: { email: string }) => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!user) throw new Error(`seed:demo: ${email} is missing`);
    return {
      collegeId,
      actorId: user.id,
      ...(await deviceOf(db, collegeId, user.id)),
    };
  };
  const viceDean = await changeBy(demoAccounts.viceDean);
  const head = await changeBy(demoAccounts.head);
  const headRole = (await listRoles(collegeId, db)).find(
    ({ key }) => key === "head",
  );
  if (!headRole) throw new Error("seed:demo: the head's role is missing");
  await setRolePermissions(
    headRole.id,
    {
      permissions: [
        ...new Set([...headRole.permissions, "rayat.import" as const]),
      ],
    },
    await changeBy(demoAccounts.admin),
    db,
  );
  const [trainer] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.collegeId, collegeId), eq(roles.key, "trainer")));
  const [directory, departments] = await Promise.all([
    listDirectory(collegeId, {}, db),
    listDepartments(collegeId, db),
  ]);
  const files = demoRayatFiles(
    random,
    { name: term.name, code: `${umAlQuraYear(term.startsOn)}1` },
    demoDepartments.map((demo) => {
      const department = departments.find(({ name }) => name === demo.name);
      return {
        // The way Rayat writes it that is not the department's name.
        rayatValue: demo.rayatValues[1],
        // The visitor first, so a section is theirs whatever the department's number of trainers.
        trainers: [
          ...(demo.name === demoVisitor.department ? [demoVisitor] : []),
          ...directory
            .filter((person) =>
              person.memberships.some(
                (membership) =>
                  membership.roleId === trainer?.id &&
                  membership.departmentId === department?.id,
              ),
            )
            .map(({ employeeNumber, name }) => ({ employeeNumber, name }))
            .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber)),
        ],
      };
    }),
  );

  const upload = async (
    kind: RayatKind,
    table: string[][],
    by: typeof viceDean,
  ) => {
    const result = await uploadRayat(kind, term.id, table, by, db);
    if (result.status !== "pending") {
      throw new Error(`seed:demo: ${kind} was not imported (${result.status})`);
    }
    return result.importId;
  };
  // SF01 is applied without its last two rows, which the newer one adds.
  const [header, ...rows] = files.sf01;
  await applyRayat(await upload("ss01", files.ss01, viceDean), viceDean, db);
  await applyRayat(
    await upload("sf01", [header, ...rows.slice(0, -2)], viceDean),
    viceDean,
    db,
  );
  await applyRayat(await upload("so01", files.so01, head), viceDean, db);
  const status = header.indexOf(rayatColumns.sf01.registrationStatus);
  await upload(
    "sf01",
    [
      header,
      ...rows.map((row, at) =>
        [5, 300, 600].includes(at)
          ? row.map((cell, column) => (column === status ? "منسحب" : cell))
          : row,
      ),
    ],
    head,
  );

  // The next SS01: the first section's meeting rows with a trainee more, from its remaining seats.
  const [ss01Header, ...ss01Rows] = files.ss01;
  const column = (field: keyof typeof rayatColumns.ss01) =>
    ss01Header.indexOf(rayatColumns.ss01[field]);
  const [ref, enrolled, remaining] = [
    column("sectionRef"),
    column("enrolled"),
    column("remaining"),
  ];
  const first = ss01Rows[0][ref];
  return {
    newerSs01: [
      ss01Header,
      ...ss01Rows.map((row) =>
        row[ref] === first
          ? row.map((cell, at) =>
              at === enrolled
                ? String(Number(cell) + 1)
                : at === remaining
                  ? String(Number(cell) - 1)
                  : cell,
            )
          : row,
      ),
    ],
  };
}
