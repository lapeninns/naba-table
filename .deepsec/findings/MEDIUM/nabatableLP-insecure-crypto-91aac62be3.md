# [MEDIUM] Database TLS certificate validation is disabled

**File:** [`scripts/import-old-school-house-menu-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-menu-staging.ts#L133-L136) (lines 133, 136)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `insecure-crypto`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The direct Postgres client used by the import sets `ssl: { rejectUnauthorized: false }`. This accepts any TLS certificate for the configured direct or pooler database URL, allowing a network-positioned attacker to impersonate the database endpoint and capture credentials or tamper with reads/writes when the script is run.

## Recommendation

Remove `rejectUnauthorized: false`; use normal certificate validation or configure the Supabase CA explicitly.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

The reported target file, `scripts/import-old-school-house-menu-staging.ts`, is no longer present in the repository, and the current importer/script inventory does not contain this deleted TLS-disabled connection path. The remaining Postgres script safety coverage asserts active database scripts do not contain `rejectUnauthorized: false`.

Validation: `pnpm exec vitest run tests/scripts/db-safety.test.ts tests/lib/logger-redaction.test.ts tests/lib/analytics-schema.test.ts tests/lib/analytics.test.ts`
