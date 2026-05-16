# [HIGH_BUG] Production DDL runner trusts DB_URL without project or confirmation guard

**File:** [`scripts/run-production-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-production-optimization.ts#L16-L183) (lines 16, 160, 173, 177, 180, 183)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-target-safety-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script treats process.env.DB_URL as the only target selector and then runs production-grade DDL. It does not validate DB_TARGET_ENV or APP_ENV, does not assert the exact Supabase project ref, and does not require an explicit production confirmation before ANALYZE, CREATE INDEX, ALTER TABLE, and FK replacement phases run. A stale or mistyped DB_URL can therefore modify the wrong remote database.

## Recommendation

Require an explicit target with a known project ref, call assertProductionScriptSafety or equivalent validation before connecting, and require a confirmation flag for production applies.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
