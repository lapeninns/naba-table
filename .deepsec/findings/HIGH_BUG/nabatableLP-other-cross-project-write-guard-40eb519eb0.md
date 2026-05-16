# [HIGH_BUG] Staging importer can write to the wrong Supabase project

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L174-L1378) (lines 174, 195, 196, 197, 216, 222, 223, 1241, 1335, 1378)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-cross-project-write-guard`

## Finding

With APPLY=true, the script creates a restaurant, copies owner/manager memberships, and imports drink menu data using service-role credentials. It reads raw env vars directly and does not enforce APP_ENV/DB_TARGET_ENV, an expected staging project ref, or a production confirmation. It also builds the pg connection from SUPABASE_DB_URL/DATABASE_URL but rewrites the host from supabase/.temp/pooler-url when that file exists, while the Supabase RPC client uses NEXT_PUBLIC_SUPABASE_URL separately. A misconfigured environment can therefore write to production, staging, or even split the workflow across two projects.

## Recommendation

Require an explicit target environment and expected project ref before APPLY=true. Validate that the Supabase URL, direct DB URL, and pooler URL all point to the same expected staging project; fail closed on mismatch. Run the repo env safety checks and require a separate confirmation for any production-capable target.

## Revalidation

**Verdict:** fixed

The staging importer named in the finding is no longer present in the current tree. Git history shows commit `72bb7412` deleted `scripts/import-old-school-house-drinks-staging.ts` entirely. A current scripts search did not find the old `import_restaurant_drink_menu_bundle` or `p_replace_modifiers` path that would create restaurants, copy memberships, or import drink data from this script. Since there is no `APPLY=true` path for this target file anymore, a misconfigured environment cannot use this deleted importer to write to production, staging, or a split Supabase target. The finding is therefore fixed by removal of the executable path.
