# [HIGH] Substring project-ref check allows service-role key exfiltration

**File:** [`scripts/grant-production-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/grant-production-restaurant-access.ts#L42-L67) (lines 42, 44, 57, 67)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-service-role-key-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The production guard accepts any Supabase URL containing the expected project ref as a substring. An attacker-controlled URL such as https://attacker.example/?ref=vrdiqfudmwydclqpydee or https://vrdiqfudmwydclqpydee.attacker.example can satisfy this check. The script then creates a Supabase client with the production service-role key and performs API calls, causing the key to be sent to the attacker-controlled host.

## Recommendation

Replace the includes check with strict URL parsing and exact host validation, preferably via a fixed assertExactSupabaseApiProjectRef helper that enforces the expected Supabase domain before using the service-role key.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
