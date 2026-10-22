# ADR-0017: Announcements

- Status: accepted (2026-10-22: the owner asked for it)
- Date: 2026-10-22
- Source: the owner's request; docs/PLAN.md, Steps 9 and 12
- Builds on: ADR-0015 (the bell opens a notification), Step 12's notifications

## Context

The owner asked: "head wants to announce something and wants everyone to know, this should show as message when trainer login right away to be shown in the middle of the page while everything is blur and then trainer can close it."

Nothing in the plan lets a head say something to the whole department. The bell tells people what the platform did (a role given, the week's digest), and it waits to be opened. An announcement is a person speaking to everyone in their scope, and it should be seen without being looked for.

## Decision

1. **A key, `announcements.publish`, scoped as every key is.**
   - A head holds it in their department, and announces to the department.
   - The dean and the vice-dean hold it across the college, and announce to the college or to one department.
   - Admins change who holds it on the roles grid. It does not require two-factor: it changes no one's access.
2. **An announcement is a title and a short text, with its author and its scope.**
   - Publishing sends it at once to every enabled account in the scope, as a notification of the kind `announcement`. The author is left out.
   - Whoever joins the scope later does not receive it.
   - It cannot be turned off in the preferences, and the preferences say so.
3. **It shows on the next page, in the middle, over the page blurred, until it is closed.**
   - Signing in leads to Today, so a trainer sees it right away; a person already signed in sees it on their next page.
   - Closing it, with its button or Escape, reads it, as opening a notification does (`notification.read`), so it does not come back. A tap beside it does not close it. It stays in the notification center.
   - Several wait one behind another, the newest first.
4. **`/announcements` holds the form and what is live.** It lists the live announcements of the scopes the viewer announces to, newest first. Their author withdraws their own, and the key held across the college withdraws anyone's; withdrawing, confirmed in a sheet, takes it from every bell and center, read or not. The page comes last in the navigation, so Today still leads an admin setting the college up to its departments.
5. **Each publication and withdrawal writes its audit event** (`announcement.publish`, `announcement.withdraw`), with the scope and how many it reached.
6. **Not now:** how many have read it ("seen by 12 of 15"), unless the owner asks; editing a published announcement (withdraw it and publish again); attachments and scheduling.

## Consequences

- A table `announcements` (college, department or none, author, title, text, published and withdrawn times); the notifications carry the announcement's id in their params.
- The app's layout reads the viewer's unread announcements with the bell's.
- `seed:demo` publishes the head of Electrical's announcement and the dean's, read by the demo accounts the end-to-end tests sign in as, so no test page opens under one. The invited trainer, who never signed in, meets the dean's at the first sign-in, which the production stack's smoke closes.
- End-to-end tests publish only to a department they make, so no other test's page opens under a dialog.
- A college seeded before this keeps its roles' keys: the base seed never changes the grid, so the admin gives the key there.
