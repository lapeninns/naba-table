# [HIGH_BUG] Direct assignment validates conflicts outside the write operation

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L254-L521) (lines 254, 292, 501, 515, 521)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

assignTablesDirectly checks existing bookings and conflicts before inserting assignments, but the validation and insert are separate database operations with no transaction, row lock, advisory lock, soft-hold acquisition, or allocator RPC. Two concurrent requests can both pass validateSelection while the target tables appear free, then both insert overlapping booking_table_assignments. This direct path also explicitly ignores holds in the busy map, so it does not get the race protection used by the hold-based flow.

## Recommendation

Move direct assignment into a single database transaction/RPC that locks the booking/table resources and enforces non-overlap at write time. Prefer the existing allocator/hold conflict path or add a database exclusion/constraint-backed write and handle overlap errors as conflicts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
