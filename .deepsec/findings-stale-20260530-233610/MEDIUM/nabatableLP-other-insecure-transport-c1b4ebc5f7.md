# [MEDIUM] Database TLS certificate verification is disabled

**File:** [`scripts/staging/replay-perf-workload.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/replay-perf-workload.ts#L37-L150) (lines 37, 42, 148, 150)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-transport`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script loads a Supabase database password and connection URL, then creates the pg Client with ssl: { rejectUnauthorized: false }. This disables CA/hostname verification for the remote Postgres connection. A network attacker able to interfere with DNS or routing for the Supabase database host could impersonate the database endpoint while the script authenticates and runs booking/stat queries.

## Recommendation

Remove rejectUnauthorized:false. Use normal CA validation, or provide/pin the Supabase CA bundle with rejectUnauthorized:true for the pooler/direct database endpoint.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
