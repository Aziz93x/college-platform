# The Eid breaks: what the web search found (ADR-0018)

Searched on 2026-10-22 for the owner's request. The dates below are what each source reported. The press mostly reports the Ministry of Education's school calendar; the technical colleges follow the same weeks.

| Break | Year | What was reported | Source |
| --- | --- | --- | --- |
| Eid al-Fitr | 1443 | Training until Thursday 20 Ramadan; the break ended Saturday 6 Shawwal, back on Sunday 7 Shawwal | press summary of the 1443 school calendar, through the web search |
| Eid al-Fitr | 1445 | Last school day Thursday 18 Ramadan (28 March 2024); back on Monday 6 Shawwal (15 April 2024) | [Ajel](https://ajel.sa/thehour/uo8m9xovvx), [Sayidaty](https://www.sayidaty.net/node/1745656) |
| Eid al-Fitr | 1447 | From 17 Ramadan (5 to 6 March 2026) to Saturday 9 Shawwal (28 March 2026), back on Sunday 10 Shawwal (29 March 2026) | [Al-Ain](https://al-ain.com/article/saudi-schools-after-eid-2026), [Al-Dostor](https://www.dostor.org/5205636) |
| Eid al-Fitr | 1448, planned | 26 February 2027 (19 Ramadan) to 13 March 2027 (5 Shawwal) | [Madaris](https://mdares.ai/sa-ar/calendar/events/eid-al-fitr-1448-break) |
| Eid al-Adha | 1443, TVTC | The break began at the end of Thursday 1 Dhu al-Hijjah 1443 | TVTC's cooperative-training timetable, through the web search |
| Eid al-Adha | 1446 | From the end of Thursday 2 Dhu al-Hijjah; back on Sunday 19 Dhu al-Hijjah ("15 days") | [Alyaum](https://www.alyaum.com/articles/6587402/الأخبار/منوعات/للطلاب-موعد-إجازة-عيد-الأضحى-2025), [Sabq](https://sabq.org/saudia/96pekquja4) |
| Eid al-Adha | 1447 | From 22 May 2026 (5 Dhu al-Hijjah) to 1 June 2026 (15 Dhu al-Hijjah), 11 days | [Madaris](https://mdares.ai/sa-ar/calendar/events/eid-al-adha-1447-break), [AboutMsr](https://aboutmsr.com/موعد-إجازة-عيد-الأضحى-1447-في-السعودية-للط/) |
| Eid al-Adha | 1448, planned | 7 May 2027 (1 Dhu al-Hijjah) to 22 May 2027, about 16 days | [Madaris](https://mdares.ai/sa-ar/calendar/events), [Okaz](https://www.okaz.com.sa/local/na/2260054) |

Left out:

- Universities. King Saud University's Eid al-Fitr 1446 break began after 13 Ramadan, longer than the schools' breaks.
- The civil service. Its breaks for employees are shorter, for example 5 to 13 Dhu al-Hijjah 1446.

## The averages

Measured in days from each Eid, using only the years where the day itself was reported:

- **Eid al-Fitr.** The break starts 10, 12, 14 and 11 days before Eid, 12 on average. It ends 5, 4, 8 and 4 days after, 5 on average.
- **Eid al-Adha.** The break starts 8, 7, 5 and 9 days before Eid, 7 on average. It ends 8, 5 and 6 days after, 6 on average.

Each break is then fitted to whole weeks: it runs from the weekend nearest its average start to the weekend nearest its average end (`src/modules/terms/domain/holidays.ts`, and its test against the table above).
