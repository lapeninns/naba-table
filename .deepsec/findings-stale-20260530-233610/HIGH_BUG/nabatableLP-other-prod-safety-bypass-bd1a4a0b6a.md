# [HIGH_BUG] Performance seed can write synthetic data to production if EXPECTED_PROJECT_REF is set to production

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/staging/seed-perf-dataset.ts#L40-L860) (lines 40, 42, 96, 119, 122, 123, 859, 860)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The apply path validates both the linked Supabase project and the DB connection string, but both are compared against args.expectedProjectRef, which is read from the generic EXPECTED_PROJECT_REF environment variable. If EXPECTED_PROJECT_REF and supabase/.temp/project-ref are set to production while DB_TARGET_ENV=staging and CONFIRM_STAGING_PERF_SEED=true, the staging safety check accepts the production connection string. The script then creates restaurants, memberships, customers, bookings, and table assignments, which would pollute production data at high volume.

## Recommendation

Use only a staging-specific expected project ref for this script, preferably DEFAULT_STAGING_PROJECT_REF or EXPECTED_STAGING_PROJECT_REF, and reject the known production ref in staging safety checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
