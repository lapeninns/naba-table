# [HIGH_BUG] Booking writes and customer profile counters are non-atomic

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings.ts#L413-L615) (lines 413, 416, 427, 603, 615)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-state-mutation`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

insertBookingRecord() inserts the booking, then separately updates the customer profile; softCancelBooking() updates status to cancelled, then separately increments cancellation profile data. If the derived profile write fails, the primary booking write has already committed but the helper throws, so callers can return failure after a successful mutation. softCancelBooking() also does not verify a non-cancelled previous state before recording a cancellation, allowing repeated calls to overcount profile cancellations.

## Recommendation

Move booking mutation and profile counter updates into an atomic RPC/transaction. Make cancellation idempotent by incrementing counters only on an actual transition from a non-cancelled status to cancelled.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`insertBookingRecord` still maintains customer profile aggregates, but those derived writes are now best-effort and cannot make an already-committed booking insert appear failed to the caller. `softCancelBooking` now updates only rows whose current status is not `cancelled`; when no transition occurs it reloads and returns the existing booking without recording another cancellation. Cancellation profile maintenance is also best-effort after the committed transition. Focused evidence: `tests/server/bookings-profile-consistency.test.ts` passed on 2026-05-16 and verifies insert profile failures do not fail booking creation, cancellation profile failures do not fail cancellation, and already-cancelled bookings do not double-count cancellations.
