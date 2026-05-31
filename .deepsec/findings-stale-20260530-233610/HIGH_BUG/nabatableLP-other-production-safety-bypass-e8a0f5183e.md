# [HIGH_BUG] QA environment guard ignores DATABASE_URL and DB_URL production targets

**File:** [`scripts/qa/environment.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/qa/environment.ts#L39-L249) (lines 39, 47, 161, 245, 248, 249)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The QA guard only collects active target URLs from QA_TARGET_URL, Playwright/app/site/reserve URLs, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, and SUPABASE_DB_URL. It then applies the production-target block only to that collected set. Repo scripts also use DATABASE_URL and DB_URL as database connection fallbacks, including destructive/database scripts, so a production Supabase URL supplied under one of the omitted env names is not classified as production-like. I verified the guard accepts an env containing a production Supabase project ref in DATABASE_URL while returning targetClass=local and destructiveAllowed=true when QA_ALLOW_DESTRUCTIVE=local.

## Recommendation

Add all database URL env aliases used by repo scripts to ACTIVE_TARGET_URL_ENV_KEYS, at minimum DATABASE_URL and DB_URL, and add regression tests proving production Supabase refs in each alias are blocked before destructive QA is allowed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
