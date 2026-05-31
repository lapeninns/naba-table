# [HIGH] Cron auto-export runs unauthenticated when CRON_SECRET is unset

**File:** [`src/app/api/cron/dual-sync/auto-export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/dual-sync/auto-export/route.ts#L10-L76) (lines 10, 27, 43, 47, 55, 76)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route treats CRON_SECRET as optional. If the environment variable is missing, it only logs a warning and continues. The handler then uses the service-role Supabase client and runs the cross-tenant dual-sync auto-export job, which can publish queued outbound changes to Google for every restaurant with open candidates. A misconfigured deployment therefore exposes a public endpoint that can trigger cross-tenant external mutations and expensive background work.

## Recommendation

Fail closed when CRON_SECRET is missing or empty, returning 401/503 before any work starts. Validate the secret through the central env layer and keep the bearer check mandatory for all cron deployments.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
