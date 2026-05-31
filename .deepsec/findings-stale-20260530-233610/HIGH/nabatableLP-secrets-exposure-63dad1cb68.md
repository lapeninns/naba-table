# [HIGH] Service-role key can be sent to a non-Supabase API host

**File:** [`scripts/generate-bookings-safe.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/generate-bookings-safe.ts#L19-L54) (lines 19, 20, 46, 54)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script validates NEXT_PUBLIC_SUPABASE_URL with assertStagingScriptSafety and then creates a Supabase service-role client. The imported API validator only compares the first DNS label with the expected project ref, so https://<expected_staging_ref>.attacker.example would pass. Once the script queries Supabase, supabase-js sends the SUPABASE_SERVICE_ROLE_KEY as API credentials to that attacker-controlled origin.

## Recommendation

Fix assertExactSupabaseApiProjectRef centrally to require https and an exact allowed Supabase host, such as <project_ref>.supabase.co, or an explicit pinned custom-domain allowlist. Keep the staging confirmation, but do not let first-label matching authorize arbitrary hosts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)
