# [MEDIUM] Supabase database TLS certificate verification is disabled

**File:** [`scripts/verify-zone-adjacencies.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/verify-zone-adjacencies.ts#L17-L102) (lines 17, 102)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads a Supabase/Postgres connection string from the environment and then creates the pg client with `ssl: { rejectUnauthorized: false }`. If an operator runs this over a hostile network or with poisoned DNS/proxy settings, an attacker can impersonate the database, capture the DB password, or tamper with verification results. The SQL is parameterized, but that does not mitigate transport-layer impersonation.

## Recommendation

Remove `rejectUnauthorized: false`. Use normal certificate validation, `sslmode=verify-full` where supported, or configure the Supabase CA explicitly and fail closed on certificate errors.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/verify-zone-adjacencies.ts` now uses `getPgSslConfig()`, which returns `rejectUnauthorized: true` and optional CA configuration. Covered by `tests/scripts/db-safety.test.ts`.
