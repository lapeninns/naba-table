# [MEDIUM] Postgres TLS certificate verification is disabled

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/seed-perf-dataset.ts#L797-L799) (lines 797, 799)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-tls-verification-disabled`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The direct Postgres client is created with `ssl: { rejectUnauthorized: false }`, so a network attacker who can intercept traffic can impersonate the database endpoint. The script sends the Supabase DB password in the connection flow, so this weakens protection for staging credentials and becomes more severe if the target is accidentally production.

## Recommendation

Enable certificate verification. Use a trusted CA bundle or the platform-supported `sslmode=require` configuration that validates the server identity, and avoid `rejectUnauthorized: false` for Supabase DB connections.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
