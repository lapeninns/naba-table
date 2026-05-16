# [HIGH] Dual-sync refresh cron runs cross-tenant provider work when CRON_SECRET is unset

**File:** [`src/app/api/cron/dual-sync/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/dual-sync/refresh/route.ts#L35-L64) (lines 35, 37, 47, 48, 63, 64)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route only enforces the bearer token if CRON_SECRET exists; otherwise it logs that the endpoint is unprotected and continues. It then calls runScheduledRefreshForAllTenants with getServiceSupabaseClient. The traced flow enumerates linked Google Business Profile restaurants, calls the Google refresh path, opens/commits snapshot runs, and recomputes persisted dual-sync state. An unauthenticated caller can therefore trigger cross-tenant provider/API work, consume quota, write refresh state, and receive restaurant IDs/errors in the response when the secret is missing.

## Recommendation

Fail closed if CRON_SECRET is unset, and centralize cron authorization so all scheduled routes share the same strict behavior. Consider suppressing detailed per-tenant errors from HTTP responses.

## Revalidation

**Verdict:** fixed

The current refresh route enters requireCronAuthAndRun before checking flags, parsing dryRun, or creating the service-role client. The shared cron auth helper fails closed with 503 if CRON_SECRETS, CRON_SECRET, and CRON_SECRET_PREVIOUS are all absent. It also rejects missing or incorrect bearer tokens with 401, then applies a rate limit and execution lock before running the callback. As a result, an unset CRON_SECRET no longer exposes runScheduledRefreshForAllTenants or dry-run tenant discovery to public callers. Git blame shows the refresh route wrapper and the fail-closed cron-auth helper came from commit 020a7389. The regression tests include the refresh route and assert that missing CRON_SECRET does not call runScheduledRefreshForAllTenants.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
