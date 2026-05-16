# [HIGH_BUG] Staging import can write to any configured Supabase project with only APPLY=true

**File:** [`scripts/import-old-school-house-menu-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-menu-staging.ts#L80-L697) (lines 80, 101, 103, 115, 561, 658, 680, 697)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-missing-production-guard`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This staging import loads .env.local, enables writes solely from APPLY=true, builds both a service-role Supabase client and a direct pg client from environment URLs, then creates restaurants, copies memberships, and imports/upserts menu items. Unlike other production-writing scripts in the repo, it has no required EXPECTED_PROJECT_REF check, no staging project-ref assertion, and no explicit confirmation guard before writes. If the local or CI environment points at production, running APPLY=true will modify production data through service-role/direct DB credentials.

## Recommendation

Require an explicit expected project ref before any apply path, default it to the staging ref for this script, and verify both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_URL/DATABASE_URL contain that ref. Also require an explicit confirmation variable for destructive or production-capable writes.

## Revalidation

**Verdict:** fixed

`scripts/import-old-school-house-menu-staging.ts` is not present in the current repository, so the described service-role/direct-DB mutation path cannot be executed from this checkout. Current script-safety work covers the remaining live staging seed/bootstrap scripts with shared `scripts/db/safety.ts` project-ref and confirmation guards.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
