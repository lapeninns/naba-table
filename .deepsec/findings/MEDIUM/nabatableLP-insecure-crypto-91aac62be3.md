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
