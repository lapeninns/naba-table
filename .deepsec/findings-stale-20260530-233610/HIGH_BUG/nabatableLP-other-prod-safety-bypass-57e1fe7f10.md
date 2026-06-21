# [HIGH_BUG] Staging owner bootstrap can be aimed at production via generic expected project ref

**File:** [`scripts/staging/bootstrap-owner.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/staging/bootstrap-owner.ts#L75-L218) (lines 75, 77, 79, 82, 114, 151, 218)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This staging-only script validates the Supabase URL with assertStagingScriptSafety, but it passes process.env.EXPECTED_PROJECT_REF before EXPECTED_STAGING_PROJECT_REF. If a caller runs it with NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for production, DB_TARGET_ENV=staging, CONFIRM_STAGING_OWNER_BOOTSTRAP=true, and EXPECTED_PROJECT_REF set to the production ref, the guard accepts the production project as the expected target. The later service-role operations create or reset an auth user password and upsert memberships for every restaurant, so a mis-targeted run can grant all-restaurant access in production.

## Recommendation

Do not accept generic EXPECTED_PROJECT_REF in staging-only scripts. Use a staging-specific ref source such as EXPECTED_STAGING_PROJECT_REF or the hard-coded DEFAULT_STAGING_PROJECT_REF, and make assertStagingScriptSafety reject the known production project ref.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
