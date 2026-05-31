# [HIGH_BUG] Production update script can write to an unverified Supabase target

**File:** [`scripts/update-railway-details.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/update-railway-details.ts#L17-L106) (lines 17, 18, 20, 38, 43, 103, 106)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script uses NEXT_PUBLIC_SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY and performs the restaurant update immediately after CONFIRM_PRODUCTION=true. EXPECTED_PROJECT_REF defaults to null, so the project-ref guard is skipped unless the operator remembers to provide it. This can silently mutate the wrong Supabase project or environment with service-role privileges, especially because there is no dry-run/APPLY gate.

## Recommendation

Require an exact expected Supabase project ref for every production-capable run, validate the URL hostname with the existing production safety helper, require DB_TARGET_ENV/APP_ENV=production, and add an APPLY=true dry-run gate before updating rows.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
