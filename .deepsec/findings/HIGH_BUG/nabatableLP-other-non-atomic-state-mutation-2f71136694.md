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

## Revalidation

**Verdict:** true-positive

`insertBookingRecord` and `softCancelBooking` still perform primary booking writes separately from customer profile aggregate updates. There is no transaction or single RPC tying those writes together. `softCancelBooking` also unconditionally updates by booking id and then records a cancellation, without verifying an actual transition from a non-cancelled status inside the same statement. Some routes check status before calling it, but the helper itself is not idempotent, and public cancellation paths can re-enter cancellation logic on an already-cancelled booking. Concurrent or repeated operations can therefore overcount cancellations or report failure after a committed mutation. This matches the finding's state-consistency impact.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
