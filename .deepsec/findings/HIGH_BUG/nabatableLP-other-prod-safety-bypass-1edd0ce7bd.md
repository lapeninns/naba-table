# [HIGH_BUG] Seed script can write the performance dataset to the wrong database

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/seed-perf-dataset.ts#L83-L797) (lines 83, 88, 100, 108, 254, 624, 736, 796, 797)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

`--apply` only checks `supabase/.temp/project-ref` against `EXPECTED_PROJECT_REF`, but the actual Postgres connection can come from `SUPABASE_DB_URL` or `DATABASE_URL` and is not checked against that ref. A stale link file plus a production DB URL/password would pass `assertStaging` and then insert/update seed restaurants, memberships, customers, bookings, and assignments in the connected database.

## Recommendation

Validate the actual connection target before connecting or writing. Parse/verify the Supabase project ref from the pooler/DB URL where possible, require `APP_ENV=staging` and `DB_TARGET_ENV=staging`, run the central env safety checks, and abort if the target matches production unless a deliberately named production override is present.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/staging/seed-perf-dataset.ts` now validates both the linked Supabase project ref and actual DB connection ref before any apply-mode connection. Apply mode requires the expected staging ref, `DB_TARGET_ENV=staging` or `APP_ENV=staging`, and `CONFIRM_STAGING_PERF_SEED=true`; dry-run still returns before database mutation. Focused script-safety tests assert the guard order and connection-ref validation.
