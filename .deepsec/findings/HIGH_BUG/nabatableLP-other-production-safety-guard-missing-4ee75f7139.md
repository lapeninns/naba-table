# [HIGH_BUG] Schema optimization script runs destructive changes against any DB URL

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-schema-optimization.ts#L13-L367) (lines 13, 148, 149, 152, 160, 176, 224, 239, 281, 315, 323, 367)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety-guard-missing`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script only requires SUPABASE_DB_URL, then runs maintenance, creates indexes, deletes orphaned data, and drops/re-adds foreign keys. There is no APP_ENV/DB_TARGET_ENV validation, expected project-ref check, staging-first guard, or production confirmation, while the banner/logs hard-code staging wording regardless of the actual connection string. runPhase catches SQL errors and the caller continues into later phases, so a failed partial migration can still proceed and exit without a hard failure.

## Recommendation

Add an expected project-ref guard and explicit target environment confirmation before any write. Fail fast on phase errors, return a non-zero exit code if any command fails, and wrap compatible schema changes in transactions or split non-transactional operations into clearly gated steps.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
