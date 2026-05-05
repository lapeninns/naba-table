# [HIGH_BUG] Booking seed script can pollute an arbitrary remote restaurant

**File:** [`scripts/seed-bookings-week-final.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week-final.ts#L4-L100) (lines 4, 5, 12, 40, 47, 56, 79, 100)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-remote-seed`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script builds a service-role Supabase client directly from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then selects the first restaurant returned by the database and inserts generated customers and confirmed bookings into it. There is no dry-run mode, explicit restaurant id/slug requirement, APP_ENV/DB_TARGET_ENV check, expected project-ref check, or production confirmation. If run with production credentials, it will silently add a week of fake bookings and customers to whichever restaurant happens to be returned first.

## Recommendation

Require an explicit RESTAURANT_ID or slug, default to dry-run, require staging/project-ref validation, and refuse production unless an explicit production override and confirmation are present. Prefer the repo env validation path or run the same safety checks as validate:env before creating a service-role client.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
