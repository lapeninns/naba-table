# [HIGH_BUG] Staging import script can mutate the wrong Supabase project

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L171-L1488) (lines 171, 175, 196, 197, 198, 210, 1349, 1438, 1483, 1488)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety`

## Finding

This staging-named import script loads .env.local, reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL/DATABASE_URL directly, then creates a service-role Supabase client and direct Postgres client. When APPLY=true, it can create a target restaurant, copy owner/manager memberships, and invoke import_restaurant_drink_menu_bundle with p_replace_modifiers=true. There is no expected project ref check, staging-only assertion, or production confirmation guard. If an operator has production values in .env.local or passes the wrong DB URL, the script can silently create/modify production restaurant data and grant memberships.

## Recommendation

Require an explicit EXPECTED_PROJECT_REF and validate both Supabase API URL and DB connection with the existing scripts/db/safety helpers before any APPLY path. For production, require a separate confirmation or break-glass env var; for this staging script, default to the staging project ref and abort on mismatch.

## Revalidation

**Verdict:** fixed

This target script has been removed from the current repository. Git history shows `72bb7412` deleted `scripts/import-old-school-house-drinks-staging.ts`, and the path is not present in `HEAD`. The described service-role client, direct Postgres client, and `APPLY=true` mutation workflow are therefore not available at this path. A current scripts search did not find the old drink-menu import RPC or `SOURCE_JS_PATH` pattern under a replacement filename. The finding was plausible historically, but it is fixed in the current code by removal of the executable mutation path.
