# [HIGH] Service-role client can be pointed at an attacker-controlled Supabase URL

**File:** [`scripts/seed-railway-from-cornerhouse.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/seed-railway-from-cornerhouse.ts#L63-L615) (lines 63, 69, 73, 615)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-service-role-key-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script only checks the Supabase project ref when CONFIRM_PRODUCTION and EXPECTED_PROJECT_REF are both set, and then relies on assertExactSupabaseApiProjectRef before later constructing a service-role Supabase client. If EXPECTED_PROJECT_REF is omitted, there is no host pinning at all. If it is supplied, the imported helper only checks the first hostname label, so a URL such as https://<expected-ref>.attacker.example would pass the guard. The subsequent service-role client calls would send SUPABASE_SERVICE_ROLE_KEY to that host. This is exploitable in CI/operator environments where a lower-privileged actor can influence NEXT_PUBLIC_SUPABASE_URL but cannot directly read the service-role secret.

## Recommendation

Require EXPECTED_PROJECT_REF for --apply and validate the full Supabase API hostname, not just the first label. Fix the shared safety helper to require an allowed Supabase host such as <project-ref>.supabase.co before constructing any service-role client.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
