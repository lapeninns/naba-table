# [HIGH_BUG] Service-role booking generator can write synthetic bookings to production

**File:** [`scripts/generate-bookings-safe.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/generate-bookings-safe.ts#L13-L154) (lines 13, 17, 18, 27, 29, 30, 31, 32, 88, 108, 134, 154)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-data-corruption`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script loads .env.local, reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, creates a service-role Supabase client, and immediately runs generateBookings(). It defaults RESTAURANT_ID, BOOKING_DATE, START_HOUR, and BOOKING_COUNT, then inserts customers, confirmed bookings, and booking_table_assignments. There is no APP_ENV check, EXPECTED_PROJECT_REF check, dry-run mode, or explicit confirmation before writes. If an operator has production Supabase values in the environment or .env.local and runs this staging-data script, the service role bypasses RLS and creates fake confirmed bookings/customers in production, corrupting live availability and customer data.

## Recommendation

Make the script dry-run by default, require explicit RESTAURANT_ID/BOOKING_DATE/BOOKING_COUNT, require EXPECTED_PROJECT_REF validation before creating the client, and block production unless an explicit confirmation or break-glass flag is supplied. Prefer the repo safety helpers used by guarded database scripts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)
