# [HIGH_BUG] Table deletion can race with future assignment creation and cascade-delete new assignments

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L337-L360) (lines 337, 360)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

DELETE first checks for future booking_table_assignments and later deletes the table in a separate operation. The table_id foreign key is configured with ON DELETE CASCADE, so if a future assignment is created after the check but before deleteTableRecord() runs, deleting the table can silently remove that newly created assignment. This can corrupt future bookings by losing their table assignment.

## Recommendation

Perform the future-assignment check and table delete inside a single transactional RPC that locks the table and relevant assignment rows, or replace hard delete with a guarded soft delete. Ensure the final delete has a NOT EXISTS future-assignment predicate evaluated atomically.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

The route no longer performs separate future-assignment lookup and table delete operations. Current `src/app/api/ops/tables/[id]/route.ts` calls `delete_table_inventory_guarded`, and `supabase/migrations/20260516083600_guard_table_inventory_delete.sql` locks the table row with `FOR UPDATE` before checking active/future assignments and deleting. New assignment inserts must satisfy the table FK and cannot pass through a concurrently locked/deleted table row without the database rechecking the final state. Focused evidence: `tests/server/ops-table-delete-route.test.ts` verifies the guarded RPC call and 409 mapping; targeted ESLint, targeted Prettier check, and `pnpm run typecheck` passed on 2026-05-16.
