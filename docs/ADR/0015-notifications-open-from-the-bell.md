# ADR-0015: Notifications open from the bell

- Status: accepted (2026-10-22: the owner accepted lead review B's proposal 1)
- Date: 2026-10-22
- Source: docs/reviews/lead-B.md, proposal 1 and journey 11; docs/PLAN.md, Step 12
- Amends: Step 12's bell, whose stack led only to the notification center

## Context

The bell's panel stacks the newest unread notifications as one button. A card carries no address, so opening one on a phone took four taps and two views: the bell, the stack, "عرض الكل", then the row in the center. Step 27 sends the work loop's reminders through the same bell, so that path would repeat every week for every trainer.

The weekly digest repeats what is still unread. A trainer told of one new role saw "إشعاران جديدان" on the bell: the role, and the digest that names it.

## Decision

1. **Each card on the bell's stack opens its notification.** A card is a link to the page the notification is about. Like a row of the center, it marks the notification read as it opens.
   - While the stack is closed, the newest card opens with one tap, and the stack's foot opens the list of the newest three.
   - Once the list is open, each card opens its own notification, and the foot leads to the center ("عرض الكل").
   - Hovering or focusing the stack still opens the list on a desktop.
2. **A digest leaves the unread count once what it names is read.**
   - A digest keeps the ids of every notification it counts: the newest three its words name, and the rest it counts after them.
   - When the last of them is read, the digest is read too: in the same reading, counted in the same `notification.read` event.
   - Digests sent before this decision keep no ids and stay as they were.

## Consequences

- Journey 11, a trainer opening something new on a phone, takes two taps and one view instead of four taps and two views.
- BeUI's notification stack becomes a group of links with a button at its foot, no longer one button (src/components/motion/PROVENANCE.md). Only the keyboard's focus opens it: a browser that focuses on contact would otherwise spread the cards under a finger mid-tap.
- The digest's params carry `ids`. The worker and `seed:demo` write them.
