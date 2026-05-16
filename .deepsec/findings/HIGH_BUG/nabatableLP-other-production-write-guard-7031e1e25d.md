# [HIGH_BUG] Staging import lacks an expected-project guard

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L170-L1383) (lines 170, 174, 195, 196, 197, 1241, 1315, 1378, 1383)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-production-write-guard`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Despite being a staging import, the script loads whatever Supabase URL, service-role key, and DB URL are present in .env.local/the environment. When APPLY=true, it creates or reuses the target restaurant, copies owner/manager memberships, and calls the drink-menu import RPC with p_replace_modifiers=true. A mispointed environment can mutate production restaurant and menu data with no project-ref or APP_ENV confirmation.

## Recommendation

Require an explicit target environment and expected Supabase project ref before any write. Verify both Supabase URL and DB URL match staging by default, and require a separate production confirmation if production writes are ever intended.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
