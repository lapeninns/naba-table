# [HIGH_BUG] Schema optimization script runs destructive changes against any DB URL

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-schema-optimization.ts#L13-L367) (lines 13, 148, 149, 152, 160, 176, 224, 239, 281, 315, 323, 367)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety-guard-missing`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script only requires SUPABASE_DB_URL, then runs maintenance, creates indexes, deletes orphaned data, and drops/re-adds foreign keys. There is no APP_ENV/DB_TARGET_ENV validation, expected project-ref check, staging-first guard, or production confirmation, while the banner/logs hard-code staging wording regardless of the actual connection string. runPhase catches SQL errors and the caller continues into later phases, so a failed partial migration can still proceed and exit without a hard failure.

## Recommendation

Add an expected project-ref guard and explicit target environment confirmation before any write. Fail fast on phase errors, return a non-zero exit code if any command fails, and wrap compatible schema changes in transactions or split non-transactional operations into clearly gated steps.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

`scripts/run-schema-optimization.ts` now uses the shared staging guard with the expected project ref, target environment marker, and `CONFIRM_STAGING_SCHEMA_OPTIMIZATION=true` before connecting. The script no longer accepts an arbitrary `SUPABASE_DB_URL` as sufficient authority for schema-changing SQL, and phase failures now throw instead of continuing to a successful exit. Focused script-safety tests assert the guard and hard-fail helpers are present and ordered before client construction.
