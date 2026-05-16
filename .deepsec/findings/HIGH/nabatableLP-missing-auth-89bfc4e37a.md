# [HIGH] Dual-sync refresh cron fails open and can be triggered publicly

**File:** [`src/app/api/cron/dual-sync/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/dual-sync/refresh/route.ts#L19-L64) (lines 19, 37, 39, 47, 48, 58, 63, 64)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The bearer check is conditional on CRON_SECRET being present. When it is absent, the route logs a warning and proceeds to run the cross-tenant scheduled refresh with a service-role Supabase client. That path discovers all linked Google Business Profile restaurants and, unless dryRun is set, pulls Google data and writes dual-sync snapshot state. A public caller could force expensive provider calls, mutate synchronization state, or use dryRun to enumerate linked restaurant IDs.

## Recommendation

Fail closed if CRON_SECRET is not configured, require the bearer token for both dry-run and mutating runs, and consider a shared cron authorization wrapper plus abuse/rate protections around external provider fan-out.

## Revalidation

**Verdict:** fixed

The fail-open pattern described in this finding is not present in the current route. GET immediately returns requireCronAuthAndRun(request, JOB_NAME, ...), so the scheduled refresh callback is unreachable until cron auth succeeds. In server/security/cron-auth.ts, an empty secret configuration produces a 503 'Cron authentication is not configured.' response instead of logging and continuing. Missing or wrong bearer tokens produce 401, and dryRun remains inside the authenticated callback. The service-role getServiceSupabaseClient call and runScheduledRefreshForAllTenants invocation therefore cannot be triggered publicly when CRON_SECRET is unset. This was patched by the 020a7389 cron-auth hardening change and is also covered by the shared cron route auth test matrix.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
