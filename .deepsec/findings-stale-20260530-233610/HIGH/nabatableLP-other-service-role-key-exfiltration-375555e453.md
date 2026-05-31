# [HIGH] Production/staging safety check can be bypassed with a spoofed Supabase host

**File:** [`scripts/ensure-auth-user.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/ensure-auth-user.ts#L57-L81) (lines 57, 68, 79, 81)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-service-role-key-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script validates the Supabase URL before creating an admin client with SUPABASE_SERVICE_ROLE_KEY, but the imported assertExactSupabaseApiProjectRef helper only compares the first hostname label to the expected project ref. A hostname like https://<expected-ref>.attacker.example passes that check, after which the admin client performs auth admin calls using the service-role key. The staging path calls the same helper through assertStagingScriptSafety, so the same host-spoofing issue applies there.

## Recommendation

Tighten the shared safety helper to require the exact Supabase API host/domain and HTTPS before createClient is called. Use the fixed helper for both production and staging checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
