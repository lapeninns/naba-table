# [MEDIUM] Region probing disables Postgres certificate verification

**File:** [`scripts/find-supabase-region.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/find-supabase-region.ts#L20-L23) (lines 20, 21, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Each candidate Supabase pooler connection uses ssl.rejectUnauthorized=false. A network or DNS MITM could impersonate a pooler endpoint and capture the database password supplied to the probe.

## Recommendation

Use TLS certificate verification for each probe, or configure the Supabase CA/expected host explicitly. Do not send database credentials to endpoints whose certificates cannot be verified.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/find-supabase-region.ts` now uses `getPgSslConfig()`, which returns `rejectUnauthorized: true` and optional CA configuration. Covered by `tests/scripts/db-safety.test.ts`.
