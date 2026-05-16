# [HIGH] Auto-complete cron mutates bookings without auth when CRON_SECRET is unset

**File:** [`src/app/api/cron/auto-complete-bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/auto-complete-bookings/route.ts#L16-L38) (lines 16, 18, 28, 29, 38)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler treats a missing CRON_SECRET as a warning and proceeds. The default request is not a dry run, so an unauthenticated caller in an environment without CRON_SECRET can invoke autoCompletePastBookings. The traced job uses the service-role client across restaurants, transitions eligible bookings through check-in/check-out, clears table assignments, and enqueues side effects.

## Recommendation

Require CRON_SECRET for every invocation and fail closed when it is absent. Keep dryRun as an explicit operational mode, not a substitute for authentication.

## Revalidation

**Verdict:** fixed

The current route no longer performs an inline optional CRON_SECRET check. GET is wrapped in requireCronAuthAndRun before parsing dryRun, limit, or invoking autoCompletePastBookings. server/security/cron-auth.ts reads CRON_SECRETS, CRON_SECRET, and CRON_SECRET_PREVIOUS, and returns a 503 response when the resulting secret list is empty. It returns 401 for missing or wrong bearer tokens and only then proceeds through rate limiting and the execution lock. The route therefore cannot reach autoCompletePastBookings in an environment with CRON_SECRET unset. Git blame shows the wrapper use and fail-closed helper were introduced in commit 020a7389, and the cron route auth tests assert that missing CRON_SECRET does not call the job.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
