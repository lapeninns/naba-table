# [HIGH_BUG] Booking mutations commit before profile updates that can still fail the request

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings.ts#L413-L615) (lines 413, 416, 427, 603, 605, 615)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-state-mutation`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

insertBookingRecord() inserts the booking and only afterward awaits recordBookingForCustomerProfile(); softCancelBooking() updates the booking to cancelled and only afterward awaits recordCancellationForCustomerProfile(). If the derived customer profile update fails after the primary booking write has committed, the helper throws and the route can return a failure even though the booking was created or cancelled. A retry can then create duplicate bookings or double-count cancellation/profile metrics.

## Recommendation

Wrap the primary booking mutation and profile update in a database transaction/RPC, or make profile maintenance idempotent and best-effort so it cannot make an already-committed booking operation appear failed. Add idempotency guards for cancellation/profile increments.

## Revalidation

**Verdict:** true-positive

`insertBookingRecord` inserts the booking and only then awaits `recordBookingForCustomerProfile`; if the profile upsert fails, the booking insert has already committed but the helper throws. `softCancelBooking` similarly updates the booking status to `cancelled` and then awaits `recordCancellationForCustomerProfile`; a later profile failure makes the caller see an error after the primary booking mutation succeeded. These functions are used in reachable paths, including cancellation routes and direct/fallback booking creation. The profile operations are not in the same transaction or RPC as the booking write. A client retry after a reported failure can create confusing duplicate or already-mutated states, and cancellation counters can diverge from booking state. The issue is therefore real as a state-consistency bug, not merely theoretical.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
