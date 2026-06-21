# [HIGH] Service-role key can be exfiltrated through first-label-only URL validation

**File:** [`scripts/seed-bookings-week-final.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/seed-bookings-week-final.ts#L6-L31) (lines 6, 7, 22, 31)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script validates SUPABASE_URL through assertStagingScriptSafety before constructing a Supabase client with SUPABASE_SERVICE_ROLE_KEY. The shared API validator accepts any hostname whose first label equals the expected project ref, without checking that the host is actually <ref>.supabase.co. A poisoned NEXT_PUBLIC_SUPABASE_URL can therefore pass the guard and receive the service-role key when the script performs inserts.

## Recommendation

Harden the shared Supabase API URL validator to pin the full hostname or a small explicit allowlist, and add tests for hosts such as <project_ref>.attacker.example and <project_ref>.supabase.co.attacker.example.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
