# [HIGH_BUG] Auto-complete persists completion before releasing table assignments

**File:** [`server/jobs/auto-complete-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/jobs/auto-complete-bookings.ts#L178-L469) (lines 178, 404, 442, 447, 469)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-state-change`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

autoCompletePastBookings applies check-in/check-out transitions through apply_booking_state_transition, then separately calls clearBookingTableAssignments. If assignment cleanup fails, the catch block only increments errors and continues; the booking status and timestamps have already been persisted as checked_in/completed, leaving stale table assignments, zone locks, or idempotency rows attached to a completed booking and blocking future capacity.

## Recommendation

Move lifecycle transition plus assignment/zone/idempotency cleanup into one database transaction/RPC that rolls back on cleanup failure. Schedule review side effects only after that atomic operation succeeds.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-27)
- lapeninns <230744634+lapeninns@users.noreply.github.com> (2026-05-15)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
