# [HIGH_BUG] Unassignment can revert a newly reassigned booking back to pending

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L585-L616) (lines 585, 601, 607, 615, 616)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

unassignTablesDirect deletes assignment rows, then separately checks whether any assignments remain, then separately updates the booking status to pending. A concurrent assignment can insert new assignment rows after the empty check but before the status update, leaving a booking with active table assignments but status pending. That can corrupt dashboard state and downstream booking workflows.

## Recommendation

Perform the delete, remaining-assignment check, and status update in one transactional database function that locks the booking row. Alternatively, update status with a single conditional SQL statement using NOT EXISTS against booking_table_assignments after the delete.

## Revalidation

**Verdict:** fixed

The application-level delete/read/update sequence has been removed from `unassignTablesDirect`. It now delegates unassignment to `unassign_tables_atomic`, and the new migration updates that RPC to lock the booking row, delete matching assignment rows, and run the pending-status rollback with a `NOT EXISTS` assignment guard inside the same database transaction. Focused evidence: `tests/server/capacity/direct-assignment-atomic.test.ts` covers the helper behavior and asserts the migration contains `FOR UPDATE`, `DELETE FROM public.booking_table_assignments`, `status = 'pending'`, and `NOT EXISTS`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
