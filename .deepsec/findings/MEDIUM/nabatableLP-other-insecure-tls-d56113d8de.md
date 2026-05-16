# [MEDIUM] SQL migration runner disables database TLS verification

**File:** [`scripts/apply-sql-file.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/apply-sql-file.ts#L86-L114) (lines 86, 111, 114)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This script executes arbitrary SQL against the database named by `SUPABASE_DB_URL` or `DATABASE_URL`, but the pg client disables certificate verification. A network-positioned attacker could impersonate Supabase, steal privileged DB credentials, or alter the SQL execution path.

## Recommendation

Use verified TLS for all database connections. Remove `rejectUnauthorized: false` and configure a trusted CA or verified Supabase connection mode.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
