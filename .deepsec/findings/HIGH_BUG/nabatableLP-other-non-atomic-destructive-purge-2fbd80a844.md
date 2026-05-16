# [HIGH_BUG] Destructive booking purge is not atomic

**File:** [`scripts/purge-restaurant-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/purge-restaurant-bookings.ts#L290-L334) (lines 290, 309, 326, 334)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-destructive-purge`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

In apply mode the script deletes booking-related rows table-by-table and only deletes the bookings at the end. Each Supabase delete is a separate committed request, so a failure after some child tables are deleted but before bookings are deleted leaves production bookings with missing state/history/holds/log rows. The booking ID set is also collected before the destructive phase, outside any transaction.

## Recommendation

Move the purge into a single Postgres function/RPC or transaction-capable database client flow using BEGIN/COMMIT/ROLLBACK. Collect the booking IDs and delete all dependent rows plus bookings inside the same transaction.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
