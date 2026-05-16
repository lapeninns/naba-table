# [HIGH_BUG] Staging import can write to any configured Supabase project

**File:** [`scripts/import-old-school-house-menu-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-menu-staging.ts#L80-L697) (lines 80, 101, 102, 103, 561, 658, 680, 697)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety-missing`

## Finding

The staging import uses `APPLY=true` as the only write gate while loading `.env.local` credentials directly. It does not require a staging project ref, `APP_ENV=staging`, `CONFIRM_PRODUCTION`, or the repo's production-resource validation before creating the target restaurant, copying owner/manager memberships, and importing menu items. If the local environment points at production, this staging script will perform production writes.

## Recommendation

Fail unless the Supabase API URL and DB URL are parsed and confirmed to match the intended staging project ref. Add an explicit confirmation for any production target and reuse the repo's environment safety checks before service-role or direct-DB writes.
