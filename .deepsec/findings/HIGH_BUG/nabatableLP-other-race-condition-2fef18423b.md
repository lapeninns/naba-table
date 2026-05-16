# [HIGH_BUG] Table deletion can race with future assignment creation and cascade-delete new assignments

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L337-L360) (lines 337, 360)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

DELETE first checks for future booking_table_assignments and later deletes the table in a separate operation. The table_id foreign key is configured with ON DELETE CASCADE, so if a future assignment is created after the check but before deleteTableRecord() runs, deleting the table can silently remove that newly created assignment. This can corrupt future bookings by losing their table assignment.

## Recommendation

Perform the future-assignment check and table delete inside a single transactional RPC that locks the table and relevant assignment rows, or replace hard delete with a guarded soft delete. Ensure the final delete has a NOT EXISTS future-assignment predicate evaluated atomically.

## Revalidation

**Verdict:** true-positive

The DELETE handler still performs a check-then-delete sequence in separate Supabase calls. It queries booking_table_assignments joined to bookings for rows with booking_date greater than or equal to tomorrowDate, and later calls deleteTableRecord without an atomic NOT EXISTS predicate or transaction. The schema still defines booking_table_assignments.table_id as a foreign key to table_inventory(id) with ON DELETE CASCADE. Assignment creation paths insert rows into booking_table_assignments independently, so a future assignment can be created after the lookup returns empty but before the table deletion commits. In that interleaving, deleting the table silently cascades to the newly-created assignment. The handler does not lock the table or relevant assignment rows, so the race remains exploitable as a data-loss bug.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
