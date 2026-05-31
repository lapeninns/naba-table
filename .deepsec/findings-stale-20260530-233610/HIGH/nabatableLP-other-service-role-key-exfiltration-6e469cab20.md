# [HIGH] Service-role script does not reliably pin the Supabase project host

**File:** [`scripts/grant-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/grant-restaurant-access.ts#L23-L67) (lines 23, 24, 53, 67)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-service-role-key-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This script requires CONFIRM_PRODUCTION but does not require EXPECTED_PROJECT_REF. When EXPECTED_PROJECT_REF is absent, it sends SUPABASE_SERVICE_ROLE_KEY to whatever NEXT_PUBLIC_SUPABASE_URL is configured. When EXPECTED_PROJECT_REF is present, the check uses substring matching, so attacker-controlled hosts containing the ref still pass. The client is then constructed with the service-role key and used for privileged membership writes.

## Recommendation

Make EXPECTED_PROJECT_REF mandatory for production writes and validate the full Supabase API hostname exactly before createClient. Do not use substring matching for project safety checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
