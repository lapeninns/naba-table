# [HIGH_BUG] Booking update and assignment clearing are not atomic

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L92-L94) (lines 92, 94)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-non-atomic-state-change`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The flow first updates the booking to the new pending details, then separately clears table assignments. clearBookingTableAssignments() catches failures and returns 0, and this caller ignores that result. If assignment clearing fails, the booking remains changed while stale table assignments/idempotency records can remain attached, corrupting capacity state for the old or new time slot.

## Recommendation

Move the booking update plus assignment/idempotency cleanup into a single strict database RPC/transaction for modification flows. Treat cleanup failure as fatal and avoid silently continuing with stale assignments.

## Revalidation

**Verdict:** true-positive

`beginBookingModificationFlow` first calls `updateBookingRecord` and only afterward calls `clearBookingTableAssignments`. Those two operations are not wrapped in a database transaction or a single strict RPC. `clearBookingTableAssignments` catches any failure, logs a warning, and returns `0`, and the modification caller ignores that return value. The clearing helper also performs assigned-zone and idempotency cleanup as separate operations whose errors are not consistently checked after successful unassignment paths. A transient database failure, RPC failure, permission/RLS mismatch, or network interruption after the booking update can therefore leave the booking changed while old table assignments or idempotency rows remain attached. That is a real capacity-state consistency bug in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
