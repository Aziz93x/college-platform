import { demoDepartments } from "./departments.ts";

// A demo person's roles: the system role, or a default role across the college or in a demo
// department, by its name.
export type DemoRole = { system: true } | { key: string; department?: string };

export type DemoAccount = {
  name: string;
  email: string;
  employeeNumber: string;
  roles: DemoRole[];
  // Replaces the password at the first sign-in.
  invited?: boolean;
  disabled?: boolean;
};

// Synthetic names, each part with the Latin spelling an email takes.
const FIRST_NAMES = [
  ["خالد", "khalid"],
  ["نورة", "noura"],
  ["عبدالله", "abdullah"],
  ["سارة", "sarah"],
  ["محمد", "mohammed"],
  ["هيفاء", "haifa"],
  ["سلطان", "sultan"],
  ["لمى", "lama"],
  ["ماجد", "majid"],
  ["منيرة", "munira"],
  ["تركي", "turki"],
  ["أمل", "amal"],
  ["بندر", "bandar"],
  ["دانة", "dana"],
  ["سعود", "saud"],
  ["عبير", "abeer"],
  ["نايف", "naif"],
  ["غادة", "ghada"],
  ["يوسف", "yousef"],
  ["جواهر", "jawaher"],
  ["ناصر", "nasser"],
  ["أروى", "arwa"],
  ["عمر", "omar"],
  ["شهد", "shahad"],
  ["فيصل", "faisal"],
  ["رهف", "rahaf"],
] as const;

const FAMILY_NAMES = [
  ["العتيبي", "alotaibi"],
  ["الغامدي", "alghamdi"],
  ["الحربي", "alharbi"],
  ["الدوسري", "aldosari"],
  ["المطيري", "almutairi"],
  ["السبيعي", "alsubaie"],
  ["الشمري", "alshammari"],
  ["العنزي", "alanazi"],
  ["الرشيدي", "alrashidi"],
  ["البقمي", "albuqami"],
  ["الجهني", "aljohani"],
  ["السهلي", "alsahli"],
  ["العمري", "alomari"],
  ["الثبيتي", "althubaiti"],
  ["الأحمدي", "alahmadi"],
  ["البلوي", "albalawi"],
  ["الشهراني", "alshahrani"],
  ["العسيري", "alasiri"],
  ["الحازمي", "alhazmi"],
  ["القرني", "alqarni"],
] as const;

// The cast beside demoAccounts (db/seed/demo/accounts.ts), by department in demoDepartments' order:
// the heads it lacks, and trainers that bring each department to 12, 15 and 13, forty in all. The
// first of each department's trainers is also its secretary, by a membership until Step 21's
// assignments give that role.
const CAST = [
  { head: "110001", trainers: 11 },
  { trainers: 14 },
  { head: "110003", trainers: 12 },
];
const FIRST_TRAINER = 200004;

// The same random sequence gives the same people. A name is never given twice, nor one of
// `taken`'s, so each email is new.
export function demoCast(random: () => number, taken: readonly string[]) {
  const used = new Set(taken);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)];
  const person = (employeeNumber: string, roles: DemoRole[]) => {
    for (;;) {
      const [first, firstLatin] = pick(FIRST_NAMES);
      const [family, familyLatin] = pick(FAMILY_NAMES);
      const name = `${first} ${family}`;
      if (used.has(name)) continue;
      used.add(name);
      return {
        name,
        email: `${firstLatin}.${familyLatin}@oasis.example`,
        employeeNumber,
        roles,
      } satisfies DemoAccount;
    }
  };

  let next = FIRST_TRAINER;
  return CAST.flatMap(({ head, trainers }, index) => {
    const department = demoDepartments[index].name;
    return [
      ...(head ? [person(head, [{ key: "head", department }])] : []),
      ...Array.from({ length: trainers }, (_, position) =>
        person(String(next++), [
          { key: "trainer", department },
          ...(position === 0 ? [{ key: "secretary", department }] : []),
        ]),
      ),
    ];
  });
}
