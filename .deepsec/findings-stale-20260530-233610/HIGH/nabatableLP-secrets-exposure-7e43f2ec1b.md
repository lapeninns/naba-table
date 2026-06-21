# [HIGH] Service-role seed client trusts an incompletely validated API URL

**File:** [`scripts/seed-bookings-week.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/seed-bookings-week.ts#L6-L31) (lines 6, 7, 22, 31)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script passes NEXT_PUBLIC_SUPABASE_URL to assertStagingScriptSafety and then creates a service-role Supabase client. Because the imported URL check only validates the hostname's first label, an attacker-controlled hostname beginning with the expected staging ref can pass validation and receive the SUPABASE_SERVICE_ROLE_KEY during subsequent insert calls.

## Recommendation

Require exact Supabase API host validation in the shared safety helper before any service-role client is created. The check should reject arbitrary domains even if their first label matches the project ref.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
