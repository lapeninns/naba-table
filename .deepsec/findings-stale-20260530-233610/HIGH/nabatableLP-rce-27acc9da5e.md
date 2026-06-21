# [HIGH] Menu data file is executed as JavaScript with Supabase secrets loaded

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L170-L1220) (lines 170, 195, 196, 197, 1217, 1220)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `rce`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script loads .env.local, reads SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL/DATABASE_URL, then reads the env-selected SOURCE_JS_PATH and evaluates it with vm.runInContext. Node's vm context is not a security sandbox; code in that file can escape to process/require/fetch, read loaded Supabase credentials, or mutate the database. This is exploitable if the menu data JS is supplied by another repo/tool/user or overridden via SOURCE_JS_PATH.

## Recommendation

Do not execute menu data as JavaScript. Store/consume JSON and parse with JSON.parse, or use a JS parser to extract a literal assignment without evaluation. If a transition is needed, process the source in a separate no-secret process with a timeout and no network/env access.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
