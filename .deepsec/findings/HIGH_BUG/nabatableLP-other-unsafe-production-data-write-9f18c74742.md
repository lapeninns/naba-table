# [HIGH_BUG] Service-role seed script can write fake bookings to an unintended remote tenant

**File:** [`scripts/seed-bookings-week.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week.ts#L4-L186) (lines 4, 5, 12, 110, 111, 127, 155, 184, 186)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-production-data-write`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script creates a service-role Supabase client directly from environment variables, selects the first restaurant, and inserts customers/bookings without target validation or a write confirmation. An accidental run with production credentials can pollute an arbitrary production restaurant with fake booking and customer data.

## Recommendation

Require explicit restaurant and environment targeting, run the repo environment safety checks, and block production unless a separate production confirmation is supplied.

## Revalidation

**Verdict:** fixed

`scripts/seed-bookings-week.ts` now calls `assertStagingScriptSafety` before constructing the service-role client. It requires exact staging project-ref validation, `DB_TARGET_ENV=staging` or `APP_ENV=staging`, and `CONFIRM_STAGING_BOOKING_SEED=true`. The script also requires an explicit `RESTAURANT_ID` instead of selecting the first restaurant in the connected project.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
