# [HIGH] Read-only adjacency script can leak the service-role key to an arbitrary URL

**File:** [`scripts/build-zone-adjacency.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/build-zone-adjacency.ts#L20-L189) (lines 20, 24, 25, 32, 33, 189)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, but EXPECTED_PROJECT_REF validation is optional. If EXPECTED_PROJECT_REF is unset, any configured URL is accepted; if it is set, the imported validator still only checks the first DNS label. In both cases a poisoned Supabase URL can cause the service-role key to be sent to an attacker-controlled origin when the script creates the client and queries restaurants/tables.

## Recommendation

Make exact project/host validation mandatory for this service-role script, or use the hardened shared safety helper. Pin the allowed Supabase API host or an explicit custom-domain allowlist before creating the client.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
