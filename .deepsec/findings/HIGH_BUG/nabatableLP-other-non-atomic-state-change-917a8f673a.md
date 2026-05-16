# [HIGH_BUG] Booking update and assignment clearing are not atomic

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L92-L94) (lines 92, 94)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-non-atomic-state-change`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The flow first updates the booking to the new pending details, then separately clears table assignments. clearBookingTableAssignments() catches failures and returns 0, and this caller ignores that result. If assignment clearing fails, the booking remains changed while stale table assignments/idempotency records can remain attached, corrupting capacity state for the old or new time slot.

## Recommendation

Move the booking update plus assignment/idempotency cleanup into a single strict database RPC/transaction for modification flows. Treat cleanup failure as fatal and avoid silently continuing with stale assignments.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)

**Verdict:** fixed

`beginBookingModificationFlow` now calls `updateBookingAndClearAssignmentsAtomically` for the pending modification write. The new `20260516095200_atomic_booking_modification_cleanup.sql` migration updates the booking, clears `assigned_zone_id`, deletes `booking_table_assignments`, and deletes `booking_assignment_idempotency` rows inside one PostgreSQL function call, so cleanup failure rolls back the booking update. Focused evidence: `tests/server/bookings-modification-flow.test.ts` passed on 2026-05-16 and verifies the modification flow uses the atomic helper.
