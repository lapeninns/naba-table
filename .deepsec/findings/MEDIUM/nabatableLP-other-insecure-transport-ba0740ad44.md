# [MEDIUM] Production DB fallback disables TLS certificate verification

**File:** [`scripts/grant-production-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-production-restaurant-access.ts#L111-L118) (lines 111, 113, 118)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-transport`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The pg fallback client uses ssl: { rejectUnauthorized: false } for the production database URL. When PRODUCTION_SUPABASE_DB_URL or another DB URL is configured and this fallback path is used, the script will not verify the server certificate, allowing a network-positioned attacker to impersonate the database endpoint and capture credentials or queried auth data.

## Recommendation

Remove the direct DB fallback if possible, or enable certificate validation with rejectUnauthorized: true and the appropriate CA configuration for the Supabase connection.

## Revalidation

**Verdict:** fixed

I read the full target file and traced the direct Postgres fallback in resolveUserIdFromDb. The current code creates the pg Client with ssl: getPgSslConfig(), not with ssl: { rejectUnauthorized: false }. The imported helper scripts/db/pg-ssl.ts returns rejectUnauthorized: true in all branches, including the default case, inline CA case, and CA-file case. The original issue was real in commit 13edb9bb, where this script used ssl: { rejectUnauthorized: false } for the PRODUCTION_SUPABASE_DB_URL/SUPABASE_DB_URL/DATABASE_URL fallback, which would have allowed a MITM database endpoint to present an untrusted certificate. Commit 020a7389 replaced that insecure option with getPgSslConfig() and added the shared helper, so certificate validation is now enforced. The later ff0eb9d9 commit did not reintroduce the TLS bypass in this path. I also checked regression coverage in tests/scripts/db-safety.test.ts, which asserts getPgSslConfig({}) returns rejectUnauthorized: true and that database scripts do not contain rejectUnauthorized: false. Targeted verification was performed with pnpm exec vitest tests/scripts/db-safety.test.ts --run, and all 27 tests passed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-16)
