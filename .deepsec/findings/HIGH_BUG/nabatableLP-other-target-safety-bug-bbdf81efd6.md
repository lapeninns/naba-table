# [HIGH_BUG] SQL runner can apply arbitrary SQL without a mandatory target guard

**File:** [`scripts/apply-sql-file.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/apply-sql-file.ts#L81-L118) (lines 81, 87, 118)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-target-safety-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads SUPABASE_DB_URL or DATABASE_URL and executes the entire --file contents. The only Supabase project check is guarded by if (args.expectedProjectRef), so omitting --expected-ref disables target validation. In this remote-only repo, a stale shell environment can apply destructive SQL to the wrong staging or production database with no exact project-ref check or confirmation. This is not web-attacker reachable, but it is a serious database operations safety bug.

## Recommendation

Require an expected Supabase project ref or explicit named safe target for every remote run. Fail closed when the ref is missing, and use assertProductionScriptSafety or an equivalent confirmation gate for production or destructive applies.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
