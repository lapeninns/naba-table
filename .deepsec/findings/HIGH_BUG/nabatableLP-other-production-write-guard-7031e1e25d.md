# [HIGH_BUG] Staging import lacks an expected-project guard

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L170-L1383) (lines 170, 174, 195, 196, 197, 1241, 1315, 1378, 1383)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-production-write-guard`

## Finding

Despite being a staging import, the script loads whatever Supabase URL, service-role key, and DB URL are present in .env.local/the environment. When APPLY=true, it creates or reuses the target restaurant, copies owner/manager memberships, and calls the drink-menu import RPC with p_replace_modifiers=true. A mispointed environment can mutate production restaurant and menu data with no project-ref or APP_ENV confirmation.

## Recommendation

Require an explicit target environment and expected Supabase project ref before any write. Verify both Supabase URL and DB URL match staging by default, and require a separate production confirmation if production writes are ever intended.

## Revalidation

**Verdict:** fixed

The current codebase no longer includes the staging import script referenced by the finding. The file was removed in commit `72bb7412`, and `git show HEAD:scripts/import-old-school-house-drinks-staging.ts` confirms it is not present in current HEAD. Without the script, there is no current `APPLY=true` path that creates or reuses the target restaurant, copies memberships, or calls the drink-menu import RPC. I also found no active script successor using the same source-file or RPC names. The production-write guard issue is therefore fixed by deletion of the importer.
