# [HIGH] Weak production URL check can leak the service-role key

**File:** [`scripts/clone-restaurant-config.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/clone-restaurant-config.ts#L105-L227) (lines 105, 107, 217, 227)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-service-role-key-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script checks whether the Supabase URL contains the expected project ref, then creates a client with the production service-role key. Because this is only substring matching, an attacker-controlled URL that embeds the ref can pass the guard and receive privileged Supabase requests carrying the service-role key.

## Recommendation

Use strict hostname validation for the Supabase API URL before creating the service-role client. Require the hostname to match the expected Supabase project host, and reject arbitrary domains even if they contain the project ref.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
