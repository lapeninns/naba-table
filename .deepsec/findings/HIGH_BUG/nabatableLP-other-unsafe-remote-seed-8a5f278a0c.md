# [HIGH_BUG] Booking seed script can write fake data to production without safeguards

**File:** [`scripts/seed-bookings-week.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week.ts#L4-L186) (lines 4, 5, 12, 110, 118, 127, 155, 186)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-remote-seed`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script directly creates a service-role Supabase client from environment variables, selects the first restaurant in the database, and inserts many generated customers and confirmed bookings. It has no dry-run mode, mandatory target restaurant, APP_ENV/DB_TARGET_ENV/project-ref validation, or production confirmation. A run with production credentials would pollute production data for an arbitrary restaurant.

## Recommendation

Require explicit target restaurant input, add dry-run by default, validate the target Supabase project/environment, and block production unless a deliberate override is supplied.

## Revalidation

**Verdict:** fixed

`scripts/seed-bookings-week.ts` is now staging-only through `assertStagingScriptSafety`, which validates the exact Supabase project ref and requires `DB_TARGET_ENV=staging` or `APP_ENV=staging` plus `CONFIRM_STAGING_BOOKING_SEED=true`. It no longer falls back to the first restaurant row; `RESTAURANT_ID` is mandatory. The lunch minute generation was also constrained to `0..59` so the seed cannot emit invalid minute values.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
