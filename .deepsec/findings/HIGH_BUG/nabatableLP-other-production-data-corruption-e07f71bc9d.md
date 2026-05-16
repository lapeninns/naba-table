# [HIGH_BUG] Service-role booking generator can write synthetic bookings to production without a target guard

**File:** [`scripts/generate-bookings-safe.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/generate-bookings-safe.ts#L13-L154) (lines 13, 17, 18, 27, 29, 32, 88, 108, 134, 154)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-data-corruption`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This operator script loads .env.local, creates a Supabase service-role client, defaults to a hard-coded RESTAURANT_ID/BOOKING_DATE/BOOKING_COUNT, and immediately inserts customers, confirmed bookings, and table assignments. There is no APP_ENV, EXPECTED_PROJECT_REF, dry-run, or explicit confirmation check before the writes. If an operator has production Supabase values in the environment or .env.local and runs the script, it will create fake confirmed bookings/customers against the production database, bypassing RLS via the service role and potentially corrupting live availability.

## Recommendation

Require an explicit staging/project-ref guard before any write, remove dangerous defaults for RESTAURANT_ID and BOOKING_DATE, add dry-run-by-default behavior, and require an affirmative confirmation flag for apply mode. Prefer routing env access through the repo's validated env/safety helpers or mirror the EXPECTED_PROJECT_REF pattern used by safer scripts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)
