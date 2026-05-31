# [MEDIUM] Database TLS certificate validation is disabled

**File:** [`scripts/production-precheck.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/production-precheck.ts#L17) (lines 17)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The production precheck connects to the Supabase database using `ssl: { rejectUnauthorized: false }`. That disables server certificate validation for the production database connection, so a network-positioned attacker could impersonate the database endpoint and capture credentials or tamper with the read-only results when an operator runs the script.

## Recommendation

Do not disable certificate verification. Use `ssl: true` with normal CA validation, or configure the Supabase CA explicitly and fail closed if validation fails.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
