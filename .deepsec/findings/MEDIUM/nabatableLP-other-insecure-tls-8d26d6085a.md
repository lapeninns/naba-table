# [MEDIUM] Performance baseline script disables database TLS verification

**File:** [`scripts/db-perf-baseline.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/db-perf-baseline.ts#L12-L370) (lines 12, 368, 370)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script connects to the Supabase database using credentials from `SUPABASE_DB_URL` or `DATABASE_URL`, then sets `ssl: { rejectUnauthorized: false }`. A MITM attacker could impersonate the database, capture credentials, or feed false performance/security metadata into the baseline output.

## Recommendation

Use verified TLS with the platform CA instead of disabling certificate validation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)

**Verdict:** fixed

`scripts/db-perf-baseline.ts` now uses `getPgSslConfig()`, which returns `rejectUnauthorized: true` and optional CA configuration. Covered by `tests/scripts/db-safety.test.ts`.
