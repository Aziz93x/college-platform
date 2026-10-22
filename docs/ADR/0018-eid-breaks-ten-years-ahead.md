# ADR-0018: The Eid breaks, ten years ahead

- Status: accepted (2026-10-22: the owner asked for it); amended the same day (decisions 6 to 8, the owner's request)
- Date: 2026-10-22
- Source: the owner's request; docs/PLAN.md, Step 13
- Builds on: Step 13's terms, calendars and week counting

## Context

The owner asked: "add 10 years muslim holidays, like ramadan and eids vacations. search the website to see the estimate vacation days and apply the average, also vice-dean can adjust that if he wants."

The Eid breaks decide a term's weeks: a week of the break goes without a number (Step 13), so a term runs on past it. Eid moves about eleven days earlier each Gregorian year, and each year's break is announced shortly before it. Today the vice-dean enters it by hand in every term.

### What the past calendars did

The Saudi school calendars, as the press reported them, show each break starting the day after the last Thursday of training and ending the Saturday before the return. Technical colleges follow the same weeks; the one TVTC date found (Eid al-Adha 1443, the break starting after Thursday 1 Dhu al-Hijjah) fits the same pattern.

| Break | Year | First day off | Last day off | Days | Eid |
| --- | --- | --- | --- | --- | --- |
| Eid al-Fitr | 1443 | Fri 21 Ramadan (22 Apr 2022) | Sat 6 Shawwal (7 May 2022) | 16 | Mon 2 May 2022 |
| Eid al-Fitr | 1445 | Fri 19 Ramadan (29 Mar 2024) | Sun 5 Shawwal (14 Apr 2024) | 17 | Wed 10 Apr 2024 |
| Eid al-Fitr | 1447 | Fri 17 Ramadan (6 Mar 2026) | Sat 9 Shawwal (28 Mar 2026) | 23 | Fri 20 Mar 2026 |
| Eid al-Fitr | 1448, planned | Fri 19 Ramadan (26 Feb 2027) | Sat 5 Shawwal (13 Mar 2027) | 16 | Tue 9 Mar 2027 |
| Eid al-Adha | 1443, TVTC | Fri 2 Dhu al-Hijjah (1 Jul 2022) | not reported | | Sat 9 Jul 2022 |
| Eid al-Adha | 1446 | Fri 3 Dhu al-Hijjah (30 May 2025) | Sat 18 Dhu al-Hijjah (14 Jun 2025) | 16 | Fri 6 Jun 2025 |
| Eid al-Adha | 1447 | Fri 5 Dhu al-Hijjah (22 May 2026) | Mon 15 Dhu al-Hijjah (1 Jun 2026) | 11 | Wed 27 May 2026 |
| Eid al-Adha | 1448, planned | Fri 1 Dhu al-Hijjah (7 May 2027) | Sat 16 Dhu al-Hijjah (22 May 2027) | 16 | Sun 16 May 2027 |

On average, the Eid al-Fitr break starts 12 days before Eid and ends 5 days after it, and the Eid al-Adha break starts 7 days before Eid and ends 6 days after it. In each of these years Ramadan was a month of training, and the Eid al-Fitr break began in its last third.

Sources: the press reports that the web search returned, among them Sabq ("إجازة عيد الأضحى 15 يومًا"), Alyaum (Eid al-Adha 1446), Al-Ain (the return after Eid al-Fitr 2026), Al-Madina (the TVTC calendar of 1448 to 1449) and the Madaris calendar for 1448. They are listed in docs/reviews/eid-breaks.md with the dates each one gave.

## Decision

1. **The college keeps its Eid breaks, ten years ahead.**
   - Each break is a row: its name, its Hijri year, its first and last days, and whether the vice-dean has adjusted it.
   - The base seed adds the breaks of the current Hijri year and the nine after it, and adds nothing that is already there. A later run reaches further ahead.
2. **Each break is estimated from the averages, in whole weeks.**
   - It begins on the first day of the weekend nearest the average start, and ends on the last day of the weekend nearest the average end.
   - The weekend is what follows the college's working days (`locale.weekStart` and `calendar.workingDays`).
   - Each Eid's date comes from the Umm al-Qura calendar that Intl already carries, so nothing is fetched.
   - Checked against the table above: Eid al-Fitr comes out exact for 1443, 1447 and 1448 and one day short for 1445. Eid al-Adha comes out exact for 1446 and 1448 and for the start of 1443, and two days short for 1447.
   - The averages and the names are data, in the base seed. The code only computes from them.
3. **The vice-dean adjusts each year's break on `/terms`, once its dates are announced.**
   - A sheet takes the new days. The break is then marked as adjusted, and the change writes `holiday.update`.
   - A break that has begun is not changed, so a closed term's weeks stay as they were counted.
4. **Every term counts the breaks that fall in it.** A term's holidays are its own and the college's breaks inside it, so one adjustment reaches every term at once.
   - The term's page lists the breaks with its calendar, marked as the college's, and its weeks skip them.
   - The breaks are not copied into the term, and the term's calendar does not edit them.
5. **Not now:** National Day. The vice-dean adds it to the term's calendar.

### Amended on 2026-10-22 (the owner's request)

The owner asked: "إجازتا عيد الفطر وعيد الأضحى ورمضان ويوم التأسيس لعشر سنوات قادمة، تكون مخفية وتظهر فقط كل سنة بسنتها، والوكيل يعتمد أو يعدل". Asked what Ramadan's holiday is, the owner chose the part of the Eid al-Fitr break that falls in Ramadan.

6. **Founding Day joins the ten years, and the Eid al-Fitr break is named for Ramadan too.**
   - Founding Day is 22 February, in the Umm al-Qura year it falls in. On the weekend's first day, the working day before it is off instead; on the weekend's last day, the working day after it. With a Friday and Saturday weekend this is the official rule: Friday gives Thursday, Saturday gives Sunday.
   - The Eid al-Fitr break starts in the last third of Ramadan, so it is named "إجازة رمضان وعيد الفطر". There is no separate Ramadan holiday.
7. **`/terms` shows only the current Umm al-Qura year's holidays.** Each year's holidays appear when that year begins. The other years stay in the table, and every term still counts the ones that fall in it.
8. **The vice-dean approves an estimate as it is, or adjusts its days.** Approving marks it approved and writes `holiday.approve`; adjusting writes `holiday.update` as before. Either way it is then shown as approved.

## Consequences

- A table `holidays` (college, key, name, Hijri year, first and last days, adjusted); migration 0014 carries it with the terms.
- `calendarOf` takes the college's breaks with the term's events, so the weeks, the header, Today and every check of an event against its term count them.
- One action, `updateHolidayAction`, needs `term.manage`. It writes `holiday.update` for new days, and `holiday.approve` for the same days on a holiday not yet approved.
- The estimates can be a few days off until the vice-dean adjusts them. Each one on `/terms` says that it is an estimate.
