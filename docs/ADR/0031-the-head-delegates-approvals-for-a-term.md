# ADR-0031: The head delegates the review and the portfolios' approval, each for a term

- Status: accepted (2026-10-23): the owner's request and their answers to six questions. Built with Steps 29 and 30
- Date: 2026-10-23
- Source: the owner's request of 23 October 2026; docs/PLAN.md, section 1 and Steps 21, 29 and 30; ADR-0028 (assignments, and the role a template grants)

## Context

The owner asked on 23 October 2026: «اضف خيار لرئيس القسم وفيه يستطيع اعطاء صلاحية الاعتماد لامين القسم .. لتسهيل الاجراءات في حال كان هناك ضغط». They want an option by which the head gives the department's secretary the power to approve, to ease the work when it piles up.

The plan gives the head two approvals (section 1):

- **the review** (Step 29): the week's sample, and the kinds the head marks as requiring approval, such as exam copies. Each is approved, or returned with a note (`review.decide`).
- **the portfolios' approval** (Step 30): each trainer's portfolio, at mid-term and at term end (`portfolio.approve`).

Neither key exists yet. The keys that nothing checked came out of the catalog (section 0), and each comes back with the step that checks it.

The owner answered six questions the same day:

1. **What may be delegated:** both the review and the portfolios' approval.
2. **For how long:** the whole term.
3. **To whom:** a member of the department whom the head picks: the secretary, or another, such as a specialty supervisor.
4. **When it is built:** with Step 29, so no key comes before a screen checks it. Until then, this record and the plan's notes keep the decision.
5. **Exam copies:** Step 30 hides an exam copy from the secretary, and from anyone but its trainer and head, until its exam's day. The review's delegate sees it before then and approves it, as the head does.
6. **How many:** «يستطيع الرئيس تفويض اكثر من شخص لاكثر من مهمة مختلفة». The head may delegate more than one person, and give different people different approvals.

## Decision

1. **Each approval is a delegation of its own.** The review is one; the portfolios' approval is the other. The head gives each to one person or more, and one person may hold both.
2. **A delegation is an assignment whose template grants a role (ADR-0028).** Beside the six shared templates, the base seed adds a template for each delegation. It has no items, so it makes no tasks. Each grants a role of its own that holds the delegation's key:
   - the review's role holds `review.decide`, from Step 29;
   - the portfolios' role holds `portfolio.approve`, from Step 30.

   The head gives a delegation on `/assignments` with `assignment.manage`, as they give the secretary's role.
   - It holds in the department for the term, until the head withdraws it there, and it is not copied into the next term.
   - A template without items asks for no weeks, since its grant lasts the whole term.
   - Giving and withdrawing a delegation write the assignment's events and tell the person, as every grant does.
   - The roles' names and the keys they hold are data, which the admin changes on the roles grid.
3. **The head keeps their keys.** A delegate decides beside the head, not in their place.
   - The department keeps one inbox and one sample a week, and a delegate does not enlarge the sample.
   - An item is decided once, by whoever acts first.
4. **No one decides on their own work.** A delegate's own tasks and portfolio are decided by the head, or by another delegate. A delegate and the head hold the same key, so the check is by person: Step 29's and Step 30's actions refuse a decision on the actor's own task or portfolio.
5. **Each decision names who made it.** The review's decisions, which are kept append-only, and the portfolios' approvals keep their actor. The trainer, the head and the log see the name.
6. **Exam copies (the owner's answer).** Step 30's confidentiality rule follows the key. Whoever holds `review.decide` in the trainer's department for the term sees an exam copy before its exam's day: the head, and the review's delegates. Everyone else sees it from that day, as before. That includes the portfolios' delegate, unless they also hold the review.

## Consequences

- Nothing new is built for the grant. Step 21's assignment already gives the role for the term and withdraws it, keeps a role the person already held, and logs both.
- Step 29 adds the review's template and its role with `review.decide`. Step 30 adds the portfolios' template and its role with `portfolio.approve`.
- Each of those steps' demo data delegates its approval in one department. Its tests cover:
  - the delegate deciding;
  - the refusal on their own work;
  - the name kept with each decision.
- The review inbox names the department's delegates and opens `/assignments` to change them, so the head finds the option where they review.
- More people see an exam copy before its day: those the head names, each named in the log with every decision.
- The check on one's own work holds for the head too, since it is by person. Where a head teaches, a delegate can decide their work. Step 29 settles who decides it where there is no delegate.
