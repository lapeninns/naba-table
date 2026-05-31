# [HIGH_BUG] Checkout can complete the booking but leave table assignments locked

**File:** [`src/app/api/ops/bookings/[id]/check-out/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/check-out/route.ts#L82-L101) (lines 82, 93, 95, 101)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-partial-state-update`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The booking state transition is persisted before table assignments are released. If clearBookingTableAssignments fails, the handler returns a 500 saying the booking was updated but assignments could not be released. At that point the booking is already completed, but its table assignments may still exist and keep capacity blocked or inconsistent until manual cleanup. This is a non-transactional multi-step state change on a capacity-critical workflow.

## Recommendation

Move checkout state transition and assignment release into one database transaction/RPC, or add a compensating rollback/reconciliation path that prevents completed bookings from retaining active assignments after a cleanup failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
