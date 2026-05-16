# [MEDIUM] Postgres TLS certificate verification is disabled before applying SQL

**File:** [`scripts/apply-sql-file.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/apply-sql-file.ts#L86-L122) (lines 86, 111, 114, 122)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads a privileged database URL from SUPABASE_DB_URL or DATABASE_URL and then executes the selected SQL file over a pg connection configured with ssl.rejectUnauthorized=false. This disables server certificate validation on a remote database write path. A network-level attacker could impersonate the database endpoint during migration/application work.

## Recommendation

Require verified TLS for database connections. Configure pg with a trusted CA/root certificate and hostname verification instead of rejectUnauthorized=false.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
