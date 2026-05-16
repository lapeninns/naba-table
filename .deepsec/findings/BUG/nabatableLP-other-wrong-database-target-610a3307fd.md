# [BUG] Staging guard does not validate the actual database connection target

**File:** [`scripts/staging/replay-perf-workload.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/replay-perf-workload.ts#L45-L157) (lines 45, 116, 123, 124, 157)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-wrong-database-target`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script checks supabase/.temp/project-ref against EXPECTED_PROJECT_REF, but the database connection is built separately from supabase/.temp/pooler-url or the SUPABASE_DB_URL/DATABASE_URL environment variables. If the project-ref file still points at staging while the selected connection URL points at production or another Supabase project, the guard passes and the script connects to the wrong database. The script is operator-run and its SQL is parameterized, so this is not a remote exploit, but it can replay performance queries and collect pg_stat_statements artifacts against the wrong remote database.

## Recommendation

Build the Postgres connection string once and validate that exact URL before connecting, for example with scripts/db/safety.ts assertExactSupabaseProjectRef. Refuse SUPABASE_DB_URL/DATABASE_URL fallbacks unless their host/user project ref matches EXPECTED_PROJECT_REF.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
