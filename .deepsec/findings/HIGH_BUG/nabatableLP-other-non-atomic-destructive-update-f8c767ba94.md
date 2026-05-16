# [HIGH_BUG] Restaurant table configuration is deleted before replacement without a transaction

**File:** [`scripts/update-railway-zones-tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/update-railway-zones-tables.ts#L171-L389) (lines 171, 183, 187, 197, 207, 219, 227, 235, 243, 251, 383, 384, 385, 387, 388, 389)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-destructive-update`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script uses the service-role client to delete booking table assignments, holds, table inventory, zones, allowed capacities, service periods, and operating hours for the restaurant, then performs the replacement inserts as separate Supabase REST calls. If the process is interrupted, a later insert fails, or two operators run the script concurrently, the restaurant can be left with deleted booking/table state and no complete replacement configuration. This is especially risky because the script is explicitly production-oriented via CONFIRM_PRODUCTION.

## Recommendation

Move the delete-and-recreate sequence into a single transactional Postgres RPC or migration, or stage replacement rows and atomically swap them. Add preflight validation, a backup/read-after plan, an advisory lock, and exact project-ref verification before any destructive step.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
