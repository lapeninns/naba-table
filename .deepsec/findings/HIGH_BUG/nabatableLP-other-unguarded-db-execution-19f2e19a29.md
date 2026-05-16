# [HIGH_BUG] Unguarded remote database executor can target the wrong Supabase project

**File:** [`scripts/execute-sql.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/execute-sql.ts#L8-L32) (lines 8, 17, 31, 32)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unguarded-db-execution`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads SUPABASE_DB_URL or DATABASE_URL directly and executes a fixed SQL file against that database with no staging/project-ref check, production confirmation, or use of the repository's environment guard pattern. In this repo, remote Supabase writes are required to stage first and dangerous scripts should fail closed against unexpected projects. If an operator or CI environment has DATABASE_URL pointed at production, this script will connect to production and execute generate_bookings.sql. The referenced SQL file is currently not committed, but the executor itself is still an unsafe path if that file exists locally or is restored.

## Recommendation

Remove this stale script or route it through the safer SQL runner pattern with an explicit --expected-ref, environment validation, and a production confirmation gate. Avoid falling back to DATABASE_URL for mutating scripts unless the expected project has been verified.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-28)
