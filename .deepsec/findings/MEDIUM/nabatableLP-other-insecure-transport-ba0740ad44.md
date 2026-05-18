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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)
