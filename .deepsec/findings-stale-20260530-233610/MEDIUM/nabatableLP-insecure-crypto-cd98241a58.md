# [MEDIUM] Database TLS certificate verification is disabled

**File:** [`scripts/execute-sql.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/execute-sql.ts#L20-L23) (lines 20, 22, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script builds a PostgreSQL client from SUPABASE_DB_URL or DATABASE_URL and explicitly sets ssl.rejectUnauthorized to false. When this operator script is run against the remote Supabase database, the client will not verify the database server certificate. An active network attacker between the operator environment and Supabase could impersonate or proxy the database endpoint and observe or modify the SQL session, including the SQL executed by this script.

## Recommendation

Enable certificate verification for remote database connections. Use the platform CA bundle or Node's trusted CA store, and only allow an explicit local-development opt-out for localhost-style URLs.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-28)
