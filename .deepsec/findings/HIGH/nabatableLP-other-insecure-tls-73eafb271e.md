# [HIGH] Production DB fallback disables TLS certificate verification

**File:** [`scripts/grant-production-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-production-restaurant-access.ts#L111-L118) (lines 111, 113, 118)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-insecure-tls`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The direct Postgres fallback creates a pg Client with ssl.rejectUnauthorized set to false. If this fallback is used with PRODUCTION_SUPABASE_DB_URL, a network/DNS MITM can impersonate the database endpoint and capture production database credentials or query traffic because the server certificate is not verified.

## Recommendation

Do not disable certificate verification. Prefer the Supabase Admin API path, or configure pg with normal certificate validation and a pinned CA bundle if Supabase requires a custom CA.

## Revalidation

**Verdict:** fixed

`scripts/grant-production-restaurant-access.ts` now creates the direct Postgres fallback client with `ssl: getPgSslConfig()`. The shared `scripts/db/pg-ssl.ts` helper always returns `rejectUnauthorized: true`, including the default path and inline/path CA bundle paths, so the production fallback no longer disables certificate verification.

Evidence: `pnpm exec vitest run tests/scripts/db-safety.test.ts` passed on 2026-05-16. The regression coverage verifies the default Postgres TLS configuration and inline CA configuration both keep `rejectUnauthorized: true`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)
