# [MEDIUM] Region probing disables TLS certificate verification

**File:** [`scripts/find-supabase-region.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/find-supabase-region.ts#L20-L23) (lines 20, 21, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script probes Supabase pooler hosts using the supplied database password but sets ssl.rejectUnauthorized to false. This makes the password-bearing Postgres connection vulnerable to server impersonation by a network or DNS MITM.

## Recommendation

Keep TLS server verification enabled and use the platform trust store or Supabase CA bundle. If a region probe fails due to certificate validation, report that explicitly rather than disabling verification.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
