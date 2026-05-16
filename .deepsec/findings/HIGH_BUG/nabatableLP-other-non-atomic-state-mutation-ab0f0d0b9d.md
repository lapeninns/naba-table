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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

Booking/profile maintenance no longer reports a committed primary booking mutation as failed when derived customer profile updates fail. `insertBookingRecord` catches and logs profile maintenance failures after returning the inserted booking, and `softCancelBooking` records cancellation profile data only after a non-cancelled row is transitioned to `cancelled`. Repeated cancellation calls reload the existing booking and do not increment profile counters again. Focused evidence: `tests/server/bookings-profile-consistency.test.ts` passed on 2026-05-16 and covers these best-effort/idempotency paths.
