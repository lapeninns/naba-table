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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
