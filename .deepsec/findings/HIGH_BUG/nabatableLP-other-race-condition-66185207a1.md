# [HIGH_BUG] Unassign can revert a booking to pending after a concurrent assignment

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L585-L615) (lines 585, 601, 609, 615)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

unassignTablesDirect deletes assignments, then separately checks whether any assignments remain, then separately updates the booking status to pending. A concurrent assignment can insert a new assignment after the empty check but before the status update, leaving a booking with active table assignments but a pending status. That can corrupt dashboard state and downstream booking workflows.

## Recommendation

Perform the delete, remaining-assignment check, and status transition in one transaction/RPC. The status update should be conditional on NOT EXISTS remaining assignments while holding the relevant booking row lock.

## Revalidation

**Verdict:** fixed

`unassignTablesDirect` now calls `unassign_tables_atomic` and returns the RPC removal count instead of deleting rows, reading remaining assignments, and updating `bookings.status` in application code. The new migration replaces `unassign_tables_atomic` with a booking-row lock plus database-side `NOT EXISTS` status rollback, so the delete and confirmed-to-pending transition happen in one transaction. Focused evidence: `tests/server/capacity/direct-assignment-atomic.test.ts` verifies the direct helper uses the RPC and does not perform table reads or writes after it.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
