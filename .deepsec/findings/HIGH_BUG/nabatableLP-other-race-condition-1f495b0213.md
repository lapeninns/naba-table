# [HIGH_BUG] Concurrent direct assignments can double-book a table

**File:** [`src/app/api/ops/bookings/[id]/assign-tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/assign-tables/route.ts#L121) (lines 121)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route delegates table assignment to assignTablesDirectly after only application-level validation. The helper validates conflicts by reading existing bookings, then performs a separate insert into booking_table_assignments without a transaction, advisory lock, serializable isolation, or database exclusion constraint visible in the repo. Two concurrent POST requests for overlapping bookings can both pass the stale conflict check and then both insert assignments for the same table/time window, corrupting restaurant capacity and reservations.

## Recommendation

Move conflict validation and insertion into a single database RPC/transaction with per-table locking or a database exclusion constraint over table_id and the assignment time range. Recheck conflicts inside that protected section before inserting.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
