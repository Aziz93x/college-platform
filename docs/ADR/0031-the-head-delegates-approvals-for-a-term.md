# ADR-0031: The head delegates the review and the portfolios' approval, each for a term

- Status: accepted (2026-10-23), amended (2026-10-24): the owner's request, their answers to six questions on 23 October and to six more on 24 October, after a review of this record against the code (docs/reviews/adr-0031.md), then to three on an exam copy's sample. Built with Steps 29 and 30
- Date: 2026-10-24
- Source: the owner's request of 23 October 2026; docs/PLAN.md, section 1 and Steps 21, 29, 30, 32 and 33; ADR-0028 (assignments, and the role a template grants); ADR-0013 (the privacy record changes with the step that stores the data)

## Context

The owner asked on 23 October 2026: «اضف خيار لرئيس القسم وفيه يستطيع اعطاء صلاحية الاعتماد لامين القسم .. لتسهيل الاجراءات في حال كان هناك ضغط». They want an option by which the head gives the department's secretary the power to approve, to ease the work when it piles up.

The plan gives the head two approvals (section 1):

- **the review** (Step 29): the week's sample, and the kinds the head marks as requiring approval, such as exam copies. Each is approved, or returned with a note (`review.decide`).
- **the portfolios' approval** (Step 30): each trainer's portfolio, at mid-term and at term end (`portfolio.approve`).

Neither key exists yet. The keys that nothing checked came out of the catalog (section 0), and each comes back with the step that checks it.

The owner answered six questions on 23 October:

1. **What may be delegated:** both the review and the portfolios' approval.
2. **For how long:** the whole term.
3. **To whom:** a member of the department whom the head picks: the secretary, or another, such as a specialty supervisor.
4. **When it is built:** with Step 29, so no key comes before a screen checks it. Until then, this record and the plan's notes keep the decision.
5. **Exam copies:** the review's delegate sees them and approves them, as the head does.
6. **How many:** «يستطيع الرئيس تفويض اكثر من شخص لاكثر من مهمة مختلفة». The head may delegate more than one person, and give different people different approvals.

A review of the first version against the code found that it left gaps: every admin would have held both keys across the college; a delegation could outlive its holder's place in the department; "decided once" and undo had no rule for several deciders; and more (docs/reviews/adr-0031.md). The owner answered six more questions on 24 October:

7. **Exam copies, again:** «نسخة الاختبار المزودة للرئيس فقط للاعتماد ولا داعي لهذا الاجراء.. خصوصا ان من سيراها فقط الرئيس والمدرب». Asked which they meant, the owner chose that the trainer, the head and the review's delegates see an exam copy, and that it stays hidden from everyone else for good, even after the exam and in an approved portfolio, where it shows as submitted and approved, without its content.
8. **The two keys are not sensitive keys:** «لا، كغيرهما». They ask for no two-factor, as other keys of a department's work do not.
9. **A head's own work:** «الرئيس نفسه». The head decides their own exam copies and approves their own portfolio.
10. **Reopening a delegate's decision:** the head may, for the rest of the term.

The owner then wrote, on 24 October: «ممكن تاخذ عينة منها بعد اعتماد رئيس القسم، وتضاف في ملف الانجاز. الاساس عندي هو ملف الانجاز، لابد ان يظهر كامل حسب المحاور التي اعتمدناها». A sample of an exam copy may go into the portfolio once the head approves the copy: the portfolio comes first, and it must show complete by the axes they adopted. This is the copy's own sample, not the review's sample of the week. They answered three questions:

11. **The copy's sample:** its trainer uploads it with the copy: pages of it, or marked answers.
12. **Who sees the sample:** everyone who reads the portfolio, in its internal version and in its display summary.
13. **A sample not uploaded:** the head sets which axes are required and which optional, for every axis of the portfolio. ADR-0034 records the answer.

## Decision

1. **Each approval is a delegation of its own.** The review is one; the portfolios' approval is the other. The head gives each to one person or more, and one person may hold both.
2. **A delegation is an assignment whose template grants a role (ADR-0028).** Beside the six shared templates, the base seed adds a template for each delegation. It has no items, so it makes no tasks. Each grants a role of its own that holds the delegation's key:
   - the review's role holds `review.decide`, from Step 29;
   - the portfolios' role holds `portfolio.approve`, from Step 30.

   The head gives a delegation on `/assignments` with `assignment.manage`, as they give the secretary's role.
   - It holds in the department for the term, until the head withdraws it there, and it is not copied into the next term. It is given for the whole term, with no weeks.
   - Giving one asks of the giver every key of the role it grants, held in the department, and no one gives one to themselves. A head holds both keys; anyone else given `assignment.manage` cannot pass on a key they lack.
   - It lasts while its holder is a member of the department: when their last other role there ends, the delegation ends too, as if the head had withdrawn it.
   - Its holders, wherever they are named, are whoever holds the delegation's key in the department through a department membership, with an enabled account: those who can decide, and no one else.
   - Giving and withdrawing a delegation write the assignment's events and tell the person, as every grant does.
   - The roles' names and the keys they hold are data, which the admin changes on the roles grid.
3. **The head keeps their keys.** A delegate decides beside the head, not in their place.
   - The department keeps one inbox and one sample a week, and a delegate does not enlarge the sample: `review.weeklyCap` caps the department's sample.
   - A submission is decided once. Returned work that comes back is a new submission, decided again. When two deciders act at once, the first decision stands and the second is refused, as decided already.
   - Undo, and reopening (the owner's answer 10): each decider undoes their own decision within the undo window, while the work is unchanged. The head may reopen any decision of the department in the term, a delegate's included, by deciding again. Each is a new decision; none is erased.
4. **A delegate never decides on their own work.** A delegate's tasks and portfolio are decided by the head, or by another delegate. A delegate and the head hold the same key, so the check is by person. A work's own people are whoever submitted it and whoever uploaded its evidence, so a task that moved with its section stays its first trainer's too. A delegate's inbox leaves out their own work. The head decides their own work, as they did before any delegation (the owner's answer 9), and it is recorded as any decision is.
5. **Each decision names who made it.** The review's decisions, which are kept append-only, and the portfolios' approvals keep their actor. The trainer, the head and the log see the name.
6. **Exam copies (the owner's answers 5, 7, 11 and 12).** An exam copy is seen by its trainer and by whoever holds `review.decide` in the task's department: the head and the review's delegates. It is decided as any reviewed work is (decisions 3 and 4).
   - No one else sees its content, at any time: not before the exam, not after it, and not in a portfolio or anything made from one. That is the frozen version, its PDFs, the department portfolio and its draft.
   - There it shows as submitted, and as approved once it is, without its content or files.
   - The portfolios' delegate without the review, the secretary, the dean, the vice-dean, the quality reviewer and the admin are among everyone else.
   - **The copy's sample.** Its trainer uploads a sample with the copy: pages of it, or marked answers. Until the copy is approved, by the head or a review's delegate, the sample is seen as the copy is. Once it is approved, the sample stands for the copy in the portfolio, for everyone who reads it, in the internal version and in the display summary. If the approval is undone or reopened, the sample leaves the portfolio until the copy is approved again; a version frozen meanwhile keeps what it froze. What the portfolio shows of a copy without a sample follows ADR-0034.
7. **The two keys count in a department only.** `review.decide` and `portfolio.approve` give their holder something only through a membership in a department. Held across the college, they give nothing, including to the system role, which holds every key. So no admin or college-wide role reviews, approves, or sees an exam copy. A department without a head gets one through a membership in it.
8. **The two keys do no more than the two approvals.**
   - `review.decide` decides the review's items, and opens the evidence of the items it decides.
   - `portfolio.approve` approves the trainers' portfolios.
   - Three powers stay with keys that no delegation holds: choosing the kinds that require approval, the department portfolio's freeze date, and approving the department portfolio's draft.
9. **Not sensitive keys (the owner's answer 8).** The two keys ask for no two-factor. So whoever helps with accounts in another department where a delegate also teaches can reset the delegate's password, as for any trainer there (`reachesAccount()`). The owner accepted this.
10. **A closed term's work is final.** A decision on a closed term's item is refused, as every other write on a closed term is.

## Consequences

- **Step 21's assignment does the grant:** it already gives the role for the term and withdraws it, keeps a role the person already held, and logs both. Steps 29 and 30 add the rest:
  - the delegation's template, and its role in `defaultRoles`. For colleges that exist already, the step's migration adds the role and gives the head its key, as `0026` did for `assignment.manage`;
  - the seed's template loader taking a template without items;
  - the delegation's template refusing weeks;
  - the rules on giving (every key of the role, and not to oneself), and the end of a delegation with its holder's last other role in the department;
  - the scope of the two keys (decision 7). A key with a rule of its own exists already: `rayat.import`.
- **Step 29 also builds:**
  - one decision per submission, which a test proves with two deciders at once;
  - undo, and the head's reopening;
  - the refusal on a closed term;
  - the inbox without the delegate's own work.
- **Step 30, with Steps 32 and 33, builds the exam copy's rule** in every view and every file made from a portfolio. Each step's tests cover:
  - the delegate deciding;
  - the refusal on their own work;
  - the name kept with each decision;
  - an exam copy hidden from everyone outside its circle;
  - its sample in the portfolio once the copy is approved, and not before, nor after the approval is undone.
- **The copy's sample is uploaded with the copy:** the evidence pipeline (Step 25) keeps it apart from the copy's own files, so that each view picks what it may show, and the exam copy's card (Step 26) asks for both.
- **The demo:** each of those steps' demo data delegates its approval in one department.
- **Who finds the option:** the review inbox names the department's delegates by key, and opens `/assignments` for whoever may change them.
- **More people see an exam copy than before:** those the head names, each named in the log with every decision they make. None of them sees one outside the department.
- **The privacy notice and the record** change with Steps 29 and 30, which store the data (ADR-0013):
  - delegates see colleagues' sampled work, their portfolios, and exam copies;
  - every decision shows who made it;
  - a copy's sample is seen by every reader of the portfolio once the copy is approved, which the notice's line on exam questions says.
- **Not taken, each with its reason in docs/reviews/adr-0031.md:**
  - a log of who opened an exam copy;
  - the authority recorded on each decision;
  - a cap on the number of delegates;
  - a sample hidden from delegates;
  - the copy's sample picked by the head from the copy's own pages: the owner chose that its trainer uploads it.
