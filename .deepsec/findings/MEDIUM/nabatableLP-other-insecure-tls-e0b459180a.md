# [MEDIUM] Production database optimizer disables TLS certificate verification

**File:** [`scripts/run-production-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-production-optimization.ts#L15-L155) (lines 15, 153, 155)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The production optimizer uses `DB_URL` and connects with `ssl: { rejectUnauthorized: false }`. Because this script runs production DDL, database impersonation can expose production credentials and allow tampering with migration execution or reported results.

## Recommendation

Require verified TLS for production database connections and fail closed on certificate validation errors.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
