# [MEDIUM] Direct Postgres connection disables certificate verification

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L227-L230) (lines 227, 230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script connects to the direct/pooler Postgres URL with ssl.rejectUnauthorized set to false. Because that connection carries database credentials and performs service-level writes, a network or DNS MITM could impersonate the database endpoint, capture credentials, or tamper with read/write results.

## Recommendation

Remove rejectUnauthorized: false; use normal TLS verification or configure the Supabase CA/expected host explicitly. Fail closed if the pooler URL cannot be verified as a Supabase endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
