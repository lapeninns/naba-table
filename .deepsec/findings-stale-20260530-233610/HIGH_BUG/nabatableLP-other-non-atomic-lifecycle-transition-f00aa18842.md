# [HIGH_BUG] No-show transition can leave stale table assignments

**File:** [`src/app/api/ops/bookings/[id]/no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/no-show/route.ts#L83-L101) (lines 83, 95, 101)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-lifecycle-transition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route persists the no-show state first, then clears table assignments in a separate operation. If clearBookingTableAssignments fails, the response admits that the booking was already updated, leaving a no-show booking potentially still holding tables and assignment idempotency records. That can corrupt availability/capacity until manually repaired.

## Recommendation

Move the state transition and table release into one database RPC/transaction, or add a compensating rollback/retry path that prevents no-show status from committing without releasing assignments.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
