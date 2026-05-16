# [HIGH_BUG] Schema optimization script runs destructive/live schema changes without environment guard

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-schema-optimization.ts#L14-L330) (lines 14, 53, 82, 151, 163, 267, 288, 322, 330)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script takes SUPABASE_DB_URL and immediately runs VACUUM/ANALYZE, non-concurrent CREATE INDEX statements, ALTER TABLE autovacuum changes, DELETE cleanup of orphan rows, and FK constraint changes. It has no dry-run/apply split, expected project ref validation, or production confirmation. A wrong connection string can therefore block writes on live tables, delete rows, or partially mutate the production schema.

## Recommendation

Add an expected project ref guard before connecting, require explicit confirmation for production, and separate precheck/dry-run from apply. For live production use, prefer CREATE INDEX CONCURRENTLY where possible and document/require a maintenance window for lock-taking operations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
