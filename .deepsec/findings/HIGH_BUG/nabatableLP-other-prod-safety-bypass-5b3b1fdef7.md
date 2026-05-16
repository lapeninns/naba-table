# [HIGH_BUG] Import script can reset production staff passwords if staging env points at production

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L193-L299) (lines 193, 194, 202, 208, 210, 152, 179, 299)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads production staff memberships from `.env.vercel-production`, but the destination `staging` client is built from `.env.local` without checking that it is actually a distinct staging project. If `.env.local` contains production Supabase values, `ensureStagingUser` will run against production: existing staff users are found and updated with newly generated passwords, profiles and memberships are upserted, and the generated credentials are written locally.

## Recommendation

Before any auth/admin mutation, parse both production and destination project refs and hard-fail if they match or if the destination is not the approved staging ref. Reuse central env validation and require an explicit staging project ref confirmation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/staging/import-prod-staff.ts` now parses and validates the destination project ref before the destination Supabase admin client is constructed. The guard rejects destination refs that equal the production ref, requires the approved staging project ref through the shared `assertStagingScriptSafety` helper, requires `DB_TARGET_ENV=staging` or `APP_ENV=staging`, and requires `CONFIRM_STAGING_STAFF_IMPORT=true`. Focused script-safety tests cover the shared staging guard and assert this import guard runs before `createClient<Database>(stagingUrl, ...)`.
