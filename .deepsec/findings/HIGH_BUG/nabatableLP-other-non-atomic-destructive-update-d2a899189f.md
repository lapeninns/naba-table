# [HIGH_BUG] Production table configuration is deleted before replacement without a transaction

**File:** [`scripts/update-railway-zones-tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/update-railway-zones-tables.ts#L171-L383) (lines 171, 183, 219, 227, 235, 243, 251, 383)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-destructive-update`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script deletes booking table assignments, holds, table inventory, zones, allowed capacities, service periods, and operating hours for the restaurant before inserting the replacement rows. These operations are separate Supabase calls, not one database transaction. If any later insert fails, the process is interrupted, or two operators run the script concurrently, production can be left with deleted booking/table state and no complete replacement configuration.

## Recommendation

Move the delete-and-recreate sequence into a single transactional database RPC or migration, or stage new rows and atomically swap them. Add a backup/preflight step and fail before any delete if all inserts cannot be validated.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`scripts/update-railway-zones-tables.ts` no longer runs the destructive replacement through separate Supabase REST calls. Apply now requires a transaction-capable DB URL, exact production project-ref validation, `DB_TARGET_ENV=production` or `APP_ENV=production`, and `CONFIRM_PRODUCTION=true`. The script opens a `pg` client, starts `BEGIN`, resolves and locks the target restaurant, clears existing table/config rows, inserts replacement capacities, zones, tables, hours, and service periods, then commits only after the full replacement succeeds; errors trigger rollback. Focused script-atomicity tests verify the delete/insert sequence is inside one transaction with rollback.
