# [MEDIUM] Schema optimization connects to Postgres without certificate verification

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-schema-optimization.ts#L260-L262) (lines 260, 262)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The pg Client is created with ssl.rejectUnauthorized=false while using SUPABASE_DB_URL. A network or DNS MITM could impersonate the Supabase pooler, capture the database password, or tamper with DDL/maintenance operations.

## Recommendation

Use TLS with certificate verification enabled. Remove rejectUnauthorized: false or configure a trusted CA/verified Supabase hostname.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
