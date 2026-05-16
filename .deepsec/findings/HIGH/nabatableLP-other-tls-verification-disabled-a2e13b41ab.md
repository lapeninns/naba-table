# [HIGH] Production database connection disables TLS verification

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L100-L104) (lines 100, 102, 104)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-tls-verification-disabled`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`loadProdMemberships` connects to the production Supabase Postgres host using the production DB password while setting `ssl: { rejectUnauthorized: false }`. A network attacker able to intercept the connection could impersonate the database endpoint and capture credentials or staff membership data.

## Recommendation

Do not disable certificate verification for production database connections. Configure node-postgres with a trusted CA bundle or a verified TLS mode supported by Supabase.

## Revalidation

**Verdict:** fixed

This finding no longer matches the current code. `loadProdMemberships` now passes `ssl: getPgSslConfig()` to `pg.Client` instead of `ssl: { rejectUnauthorized: false }`. The imported helper in `scripts/db/pg-ssl.ts` returns `{ rejectUnauthorized: true }` by default and also keeps verification enabled when a CA is provided via `SUPABASE_DB_CA_CERT`, `SUPABASE_DB_CA_CERT_PATH`, or `NODE_EXTRA_CA_CERTS`. Git history shows commit `020a7389` added this helper and replaced the disabled-verification setting in `scripts/staging/import-prod-staff.ts`. I did not find a remaining disabled TLS verification setting in this script.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
