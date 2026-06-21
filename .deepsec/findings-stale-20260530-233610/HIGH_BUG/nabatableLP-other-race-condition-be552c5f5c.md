# [HIGH_BUG] Post-unassign status rollback can race booking state back to pending

**File:** [`src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts#L82-L113) (lines 82, 91, 99, 100, 106, 107, 113)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

unassignTableFromBooking calls the unassign_tables_atomic RPC, which already locks the booking and updates status to pending only when no assignments remain. The handler then performs a separate read of remaining assignments and a separate status update. A concurrent assignment can occur after tableAssignments is read as empty but before the later status SELECT/UPDATE; if that assignment confirms the booking, this handler can observe status='confirmed' and update the booking back to pending without rechecking that assignments are still empty.

## Recommendation

Remove the redundant post-RPC status rollback and trust unassign_tables_atomic, or move the final status update into a single transactional statement that includes a NOT EXISTS remaining-assignment predicate at update time.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
