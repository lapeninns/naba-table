# [HIGH_BUG] Destructive purge is not atomic and can leave bookings partially deleted

**File:** [`scripts/purge-restaurant-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/purge-restaurant-bookings.ts#L292-L319) (lines 292, 308, 315, 319)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-destructive-purge`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

In apply mode the script deletes related booking rows table-by-table, then deletes the bookings last. Each Supabase call is its own committed request; there is no database transaction or RPC wrapping the purge. If any later delete fails after earlier deletes have succeeded, the script exits through the catch handler with the booking rows still present but with related state/history/holds/logs already removed. That can corrupt production booking data during a failed purge attempt.

## Recommendation

Move the purge into a single Postgres function/RPC that runs in one transaction, or otherwise use a transaction-capable database client with BEGIN/COMMIT/ROLLBACK. Keep the booking ID set stable inside the transaction and fail without committing partial child-table deletions.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

**Verdict:** fixed

`scripts/purge-restaurant-bookings.ts` now performs apply-mode deletion through a single `pg` transaction. It re-collects matching booking ids inside `BEGIN` using `FOR UPDATE`, deletes configured child rows and the bookings in the same transaction, commits only after all deletes succeed, and rolls back on any failure. The script also requires `SUPABASE_DB_URL`/`DATABASE_URL`/`DB_URL`, exact project-ref validation, production target env, `CONFIRM_PURGE_BOOKINGS=true`, and `CONFIRM_PRODUCTION=true` before apply. Focused tests verify the transaction ordering and rollback path.
