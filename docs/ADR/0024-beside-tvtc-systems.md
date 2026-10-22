# ADR-0024: Beside TVTC's systems: Rayat, Microsoft 365, Blackboard and EthaqPlus

- Status: proposed
- Date: 2026-10-22
- Source: the owner's answers on 22 October 2026, on what Rayat is, how its reports are made, and which TVTC sites staff open with their Microsoft 365 accounts
- Builds on:
  - Step 16's Rayat import and ADR-0019;
  - ADR-0013 (personal data), decision 2;
  - docs/PLAN.md section 1, "Out of scope for now, ready by design: Microsoft Entra sign-in and SharePoint storage", and the backlog in section 8.

## Context

The owner described the systems a college already works in:
- **Rayat** is where trainers take attendance and submit grades. Its reports, SS01, SF01 and SO01, come from **Evisions Argos**, a reporting tool that usually runs over Ellucian Banner. Whether Rayat is Banner is to confirm with TVTC IT.
- **Argos** runs a report on a schedule that an Argos administrator sets up. A schedule's "Send an Email" task attaches the report by default; an FTP or SFTP task sends it to a server instead. Both need Argos's scheduling module licensed, and the mail or FTP server added on the Argos side.
- **Microsoft 365:** staff sign in to several TVTC sites with their Microsoft 365 accounts, such as خدوم and إيثاق.
- **Blackboard** is the learning system: courses, assignments, exams and the grade centre.
- **EthaqPlus (إيثاق)**, at `ethaqplus.tvtc.gov.sa`, is TVTC's file storage. Its login page names Nextcloud, an open-source file server, and TVTC hosts it in the Kingdom.

None of them holds the work loop this platform exists for: the department plan, each trainer's tasks per section, their evidence, the head's review, and the portfolio by TVTC's axes. Today that work is kept by hand and assembled at the term's end.

## Decision

1. **The platform sits beside them and copies none of them.** Rayat stays the record of trainees, attendance and grades. Blackboard stays the classroom, and EthaqPlus TVTC's archive. The platform owns the work loop and reads only what it needs.
2. **Files stay the boundary with Rayat.** The platform reads Argos's exports, as Step 16 built, and never connects to Rayat's database.
   - **Formats:** the CSV report type and Excel (.xlsx) are read, and the upload already names both in its hint and when it refuses a file. Banded and crosstab reports (PDF), extracts (fixed-width or XML) and the old Excel format (.xls) are not; an .xls saved again as .xlsx is.
   - **Less at the source:** TVTC's Argos team is asked for versions of SF01 and SO01 without names, mobile numbers and grades, or with counts per section (ADR-0013, decision 2).
3. **Scheduled reports arrive by mail, after the trial.** An Argos schedule mails SS01, SF01 and SO01 each week to a mailbox for the college. The platform reads each attachment into an upload waiting to be applied (Step 16). So the importer still reviews the change before applying or discarding it, and rollback stays. SFTP to the platform's server is the other way, where Argos can reach it.
4. **Staff sign in with Microsoft 365, after the trial.** The platform is registered in TVTC's Microsoft Entra ID, as the sites staff already use are.
   - An account is linked by its email, which Step 10 already keeps as the person's Microsoft 365 address. Nobody gets a new password.
   - Where TVTC requires Microsoft's two-step sign-in, it then covers those accounts, which meets ECC-2:2024 2-2-3-2 better than ADR-0014's setting. A leaver whose Microsoft 365 account is disabled can no longer sign in.
   - The platform's own passwords stay for the trial and for anyone without a Microsoft 365 account.
5. **Approved portfolios are archived in EthaqPlus.** At each approval (Steps 30 and 32), the platform saves the portfolio's PDF to EthaqPlus over Nextcloud's file interface (WebDAV), in the folder TVTC names for the college, the department, the trainer and the term. The plan's `StorageAdapter` named SharePoint for files after approval (section 2); the approved PDFs go to EthaqPlus instead, where TVTC keeps its files. The term's evidence stays on the platform's own disk, where phone uploads, the offline queue and review need it.
6. **Some tasks Rayat already proves.** A task such as "enter the midterm grades by week 9" or "take attendance each week" can count as done from an Argos report that says, per section, whether grades or attendance were entered, instead of a screenshot. Only that yes or no is kept, never a grade or a name. This needs that report from TVTC's Argos team. Step 18 defines the kind, and Steps 20 and 26 decide how such a task completes.
7. **Blackboard later, if at all.** Blackboard's activity, such as an exam set or grades posted, could become evidence the same way. It needs access to Blackboard's interface and is not planned.

## Consequences

- **Network.** Microsoft sign-in, the mailbox and EthaqPlus all need the server to reach them, and Microsoft sign-in needs each phone to reach Microsoft too. On option A, the college network lets the server reach Microsoft's sign-in and mail services and `ethaqplus.tvtc.gov.sa`; on option B it already can. The rule that the platform fetches no fonts, scripts or other assets from the internet does not change.
- **Personal data.** The record (`docs/privacy/data-protection.md`) gains a row as each is built: the mailbox's attachments, deleted once read; the Entra link on each account; and the PDFs sent to EthaqPlus, which TVTC's archive then keeps under its own retention.
- **The trial changes nothing.** None of this is built before it: uploads by hand, the platform's own passwords and PDFs downloaded by hand cover it.
- **On acceptance, the plan gains notes:** Step 16 (the scheduled mailbox), Steps 18, 20 and 26 (tasks Rayat proves), Steps 30 and 32 (archiving to EthaqPlus), the backlog's Entra sign-in, and section 7's go-live checklist (the requests below).

## Requests to TVTC IT

1. Is Rayat Ellucian Banner, and who runs Argos for the colleges?
2. Register the platform in Microsoft Entra ID for staff sign-in.
3. A mailbox for Rayat reports, and an Argos schedule that mails SS01, SF01 and SO01 to it each week, ideally without names, mobile numbers and grades.
4. An EthaqPlus account for the platform, with the college's folder, to save approved portfolios.
5. An Argos report of grade and attendance entry per section, without names or grades.

## Sources

- Evisions, Argos help: [report types](https://webhelp.evisions.com/HelpFiles/Argos/en/Content/Reports.htm), [scheduling](https://webhelp.evisions.com/HelpFiles/Argos/en/Content/Scheduling.html), [the Send an Email task](https://webhelp.evisions.com/HelpFiles/Argos/en/Content/Schedule%20Task%20-%20Send%20an%20Email.htm), and [FTP or SFTP results](https://webhelp.evisions.com/releaseguides/argos/Content/4.0/Send%20Report%20Results%20via%20FTP%20or%20SFTP.htm)
- Prairie View A&M University, [Argos FAQs](https://pvamu.edu/irm/information-resources/argos-reporting/argos-faqs): Argos reports on Banner's data
- A guide to Rayat, [منصة رايات TVTC](https://www.wdeftksa.com/sa/guides/rayat-tvtc): Blackboard for courses and grades, Nafath for trainees' sign-in
- EthaqPlus's login page, as two site indexes recorded it: [sur.ly](https://sur.ly/i/ethaq.tvtc.gov.sa/) ("Login – EthaqPlus", naming Nextcloud, a server in Saudi Arabia) and [Website Informer](https://website.informer.com/ethaq.tvtc.gov.sa) (hosted by the Technical and Vocational Training Corporation). The site itself declines automated reading.
