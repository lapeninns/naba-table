# [HIGH_BUG] Table deletion misses same-day assignments and races with new assignments

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L333-L360) (lines 333, 337, 341, 359, 360)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

DELETE computes tomorrowDate and only blocks assignments whose booking_date is greater than or equal to tomorrow, so a table assigned to a later booking today can still be deleted. The subsequent delete removes the table, and the booking_table_assignments foreign key is configured with ON DELETE CASCADE, so those assignments are silently removed. The assignment check and delete are also separate statements, so a concurrent future assignment created after the check can be deleted by the cascade.

## Recommendation

Move deletion into a transactional database function that locks the table row and deletes only when no non-cancelled assignments exist from the current time onward. Prefer a NOT EXISTS guard in the DELETE statement or a restrictive FK over check-then-delete logic.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

The DELETE handler now calls the service-role-only `delete_table_inventory_guarded` RPC instead of doing a route-level check-then-delete. The RPC locks the `table_inventory` row, rejects non-cancelled assignments on the current or future booking date before deleting, and returns a 409 through the route when active/future assignments exist. `types/supabase.ts` now includes the RPC signature, so `pnpm run typecheck` proves the route call. Focused evidence: `pnpm exec vitest run tests/server/ops-table-delete-route.test.ts tests/server/ops-booking-table-assignment-route.test.ts tests/server/capacity/direct-assignment-atomic.test.ts`, targeted ESLint, targeted Prettier check, and `pnpm run typecheck` all passed on 2026-05-16.
