# [MEDIUM] Postgres TLS certificate verification is disabled

**File:** [`scripts/staging/replay-perf-workload.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/replay-perf-workload.ts#L37-L150) (lines 37, 49, 50, 148, 150)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads the Supabase database password, injects it into the Postgres connection string, and then creates a pg Client with `ssl: { rejectUnauthorized: false }`. That encrypts traffic but does not verify the database server certificate or hostname, so an attacker with DNS/network MITM position when an operator runs the script could impersonate the Supabase database endpoint and capture the Postgres password or query results. The script is operator-run rather than remotely reachable, which limits severity, but the credential involved is a direct database password.

## Recommendation

Do not disable TLS verification. Use verified TLS for Supabase Postgres connections, for example by omitting `rejectUnauthorized: false` when the platform CA is trusted, configuring `sslmode=verify-full`, or supplying the expected CA certificate explicitly.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
