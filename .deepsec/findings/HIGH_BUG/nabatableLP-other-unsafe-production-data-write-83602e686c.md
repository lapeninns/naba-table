# [HIGH_BUG] Service-role seed script can write fake bookings to an unintended remote tenant

**File:** [`scripts/seed-bookings-week-final.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week-final.ts#L4-L100) (lines 4, 5, 12, 40, 41, 56, 79, 98, 100)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-production-data-write`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script builds a Supabase service-role client directly from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, only checks that both variables exist, selects the first restaurant, and immediately inserts customers and bookings. It has no APP_ENV/DB_TARGET_ENV validation, staging-only guard, explicit target project check, mandatory restaurant id, or write confirmation. If run with production environment variables, it can create a week of fake customers and bookings in an arbitrary production restaurant; service-role access bypasses RLS, so tenant protections do not mitigate the blast radius.

## Recommendation

Route this through the repo env/safety guard pattern, require an explicit --restaurant-id and --target, refuse production by default, and require a dedicated confirmation such as CONFIRM_SEED_BOOKINGS=true before any writes.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
