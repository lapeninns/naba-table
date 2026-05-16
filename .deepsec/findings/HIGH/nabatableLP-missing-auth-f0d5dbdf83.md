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

## Revalidation

**Verdict:** fixed

The current auto-export handler is wrapped in requireCronAuthAndRun at the top of GET. The feature flag check, query parsing, getServiceSupabaseClient call, and runAutoExportForAllTenants call all happen inside that authenticated callback. requireCronAuth returns 503 when no cron secrets are configured and 401 when the bearer token is absent or invalid. That means a missing CRON_SECRET now fails closed before the service-role client is used or cross-tenant export work begins. Git blame attributes this wrapper change to commit 020a7389. Existing cron route auth tests also cover dual-sync auto-export and assert that missing or wrong secrets prevent runAutoExportForAllTenants from being called.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
