# [MEDIUM] Privileged Postgres connection disables TLS certificate verification

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L227-L230) (lines 227, 228, 229, 230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The pg client sets ssl.rejectUnauthorized to false while using the database password derived from SUPABASE_DB_URL/DATABASE_URL. This still encrypts traffic, but it does not authenticate the Supabase server, so a DNS/network MITM could impersonate the database endpoint and capture credentials or queries.

## Recommendation

Use certificate-verifying TLS for Postgres connections, ideally verify-full semantics with Supabase's CA bundle or the platform trust store. Do not disable rejectUnauthorized for scripts that carry service-role or database credentials.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
