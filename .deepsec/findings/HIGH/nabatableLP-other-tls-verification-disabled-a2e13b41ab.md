# [HIGH] Production database connection disables TLS verification

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L100-L104) (lines 100, 102, 104)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-tls-verification-disabled`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

`loadProdMemberships` connects to the production Supabase Postgres host using the production DB password while setting `ssl: { rejectUnauthorized: false }`. A network attacker able to intercept the connection could impersonate the database endpoint and capture credentials or staff membership data.

## Recommendation

Do not disable certificate verification for production database connections. Configure node-postgres with a trusted CA bundle or a verified TLS mode supported by Supabase.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
