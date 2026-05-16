# [HIGH_BUG] Non-atomic unassign status rollback can corrupt booking state

**File:** [`src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts#L82-L107) (lines 82, 91, 99, 107)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler unassigns a table, separately reloads assignments, then sets the booking back to pending when the returned assignment list is empty. Those operations are not transactional. A concurrent assignment can occur after the empty read but before the status update, leaving a booking with assigned tables incorrectly marked pending. The imported helpers worsen this because unassignTableFromBooking returns false on RPC errors and getBookingTableAssignments returns an empty array on read errors, while this route ignores the unassign result and treats an empty assignment list as authoritative.

## Recommendation

Move unassign, remaining-assignment count, and conditional status transition into one database RPC/transaction. Make assignment-read failures explicit errors, check the unassign result, and guard any status rollback with a database-side NOT EXISTS condition for current assignments.

## Revalidation

**Verdict:** fixed

The single-table DELETE route now checks the `unassignTableFromBooking` result and no longer performs route-level remaining-assignment reads followed by a separate booking-status update. `unassignTableFromBooking` now throws on `unassign_tables_atomic` RPC errors, and `getBookingTableAssignments` throws on reload errors instead of returning an empty list. The new `20260516092900_atomic_unassign_tables_status.sql` migration makes `unassign_tables_atomic` lock the booking row, delete assignments, and conditionally set confirmed bookings back to pending with a database-side `NOT EXISTS` guard in the same transaction. Focused evidence: `tests/server/ops-booking-table-unassign-route.test.ts`, `tests/server/capacity/table-assignment-unassign.test.ts`, and `tests/server/capacity/direct-assignment-atomic.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
