# [HIGH_BUG] Direct assignment conflict check is not atomic with assignment insert

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L292-L521) (lines 292, 293, 294, 502, 512, 515, 521)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

assignTablesDirectly validates table conflicts by loading context bookings and building an in-memory busy map before it inserts into booking_table_assignments. The actual insert happens later as a separate database operation, and I found no migration-level exclusion constraint or transaction wrapping this direct path. Two concurrent requests assigning the same table for overlapping booking windows can both observe no conflicts and both insert rows. This path also explicitly passes holds: [] into buildBusyMaps, so it bypasses the soft-hold race protection used by the manual flow.

## Recommendation

Move conflict detection and insert into a single database transaction/RPC with row or advisory locks, or enforce a database exclusion constraint over table_id and assignment window. If soft holds remain part of the system, include active holds in the direct assignment conflict check or remove the direct path.

## Revalidation

**Verdict:** fixed

The direct helper keeps its pre-validation for operator feedback, but the write is no longer the old direct insert. `assignTablesDirectly` now commits through `assignTableToBooking`, which routes to the allocator v2 atomic assignment path and maps allocator conflicts back to direct-assignment errors. It then reloads the committed assignment rows rather than returning an optimistic insert result. Focused evidence: `tests/server/capacity/direct-assignment-atomic.test.ts` verifies atomic helper delegation; `pnpm exec vitest run tests/server/ops-table-delete-route.test.ts tests/server/ops-booking-table-assignment-route.test.ts tests/server/capacity/direct-assignment-atomic.test.ts`, targeted ESLint, targeted Prettier check, and `pnpm run typecheck` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
