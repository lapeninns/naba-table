# [HIGH_BUG] Database executor lacks target safety checks

**File:** [`scripts/execute-sql.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/execute-sql.ts#L9-L31) (lines 9, 21, 30, 31)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-unguarded-db-execution`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script executes a SQL payload against whichever SUPABASE_DB_URL or DATABASE_URL is present, with no expected Supabase project-ref check, target environment check, dry-run mode, or production confirmation. In this repo Supabase is remote-only and production/staging separation is a stated safety requirement, so an inherited or stale DATABASE_URL can make an operator run the booking-generation SQL against the wrong remote project. The current tracked checkout is partially mitigated by the missing generate_bookings.sql file, but the guard is still absent and the script would execute immediately if that file exists locally or is restored.

## Recommendation

Require an explicit target project ref or environment argument and validate the connection string before connecting. Prefer reusing the guarded scripts/db/safety.ts pattern or the safer scripts/apply-sql-file.ts flow, and require explicit confirmation for production-capable writes.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-28)
