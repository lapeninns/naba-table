# [BUG] Staging guard does not validate the database URL actually used

**File:** [`scripts/staging/replay-perf-workload.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/replay-perf-workload.ts#L42-L148) (lines 42, 113, 119, 148)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-wrong-database-target`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script checks supabase/.temp/project-ref against EXPECTED_PROJECT_REF, but buildPgConnectionString() can still fall back to SUPABASE_DB_URL or DATABASE_URL when supabase/.temp/pooler-url is absent. Those fallback URLs are not checked against the expected project ref, so a stale staging link plus a production or wrong-project DATABASE_URL would pass the guard and replay the workload against the wrong database.

## Recommendation

Validate the selected connection string itself before connecting, for example by requiring the expected project ref in the host/user portion or by refusing env URL fallbacks unless they match EXPECTED_PROJECT_REF.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/staging/replay-perf-workload.ts` now builds the exact Postgres
connection string once and validates that selected URL with
`assertExactSupabaseProjectRef(connectionString, expectedProjectRef)` before
creating the `pg` client.

Evidence:

- `tests/scripts/perf-script-safety.test.ts` verifies the connection-string
  project-ref guard appears before `new Client`.
- `tests/scripts/db-safety.test.ts` covers the shared Supabase project-ref guard.
- `pnpm exec vitest run tests/scripts/perf-script-safety.test.ts tests/scripts/db-safety.test.ts`
