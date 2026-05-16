# [MEDIUM] Database schema script disables TLS certificate verification

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-schema-optimization.ts#L260-L262) (lines 260, 261, 262)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The pg client connects with ssl.rejectUnauthorized set to false while using a privileged database URL. A network or DNS MITM could impersonate the Supabase database endpoint and capture credentials or observe/alter migration traffic.

## Recommendation

Use certificate-verifying TLS for Postgres connections and supply the Supabase CA bundle if needed. Avoid rejectUnauthorized:false for privileged maintenance scripts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
