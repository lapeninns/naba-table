# [HIGH_BUG] Staging bootstrap can grant all-restaurant access to production

**File:** [`scripts/staging/bootstrap-owner.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/bootstrap-owner.ts#L70-L197) (lines 70, 72, 93, 100, 133, 181, 197)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script is named and logged as a staging bootstrap, but it loads `.env.local` directly and builds a Supabase service-role client from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` without validating `APP_ENV`, project ref, or whether the values match production. It then creates or updates an auth user and grants that user membership to every restaurant. If an operator runs this with production env values, it can create a production owner/manager account or reset an existing production user's password and grant access across all restaurants.

## Recommendation

Hard-fail unless the resolved Supabase URL matches an explicit staging project ref and the validated env indicates staging. Reuse the central env validation or run the same production-resource checks as `pnpm validate:env`; also require an explicit confirmation/project-ref for any service-role mutation.

## Revalidation

**Verdict:** fixed

`scripts/staging/bootstrap-owner.ts` now calls `assertStagingScriptSafety` immediately after reading the Supabase URL and before generated password persistence or service-role client construction. The guard requires the expected staging project ref, `DB_TARGET_ENV=staging` or `APP_ENV=staging`, and `CONFIRM_STAGING_OWNER_BOOTSTRAP=true`. Focused script-safety tests verify the guard runs before `writePasswordToGitignoredBackups` and before `createClient<Database>(supabaseUrl, ...)`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
