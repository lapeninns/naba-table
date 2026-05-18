# [HIGH] Auto-complete cron mutates bookings without auth when CRON_SECRET is unset

**File:** [`src/app/api/cron/auto-complete-bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/auto-complete-bookings/route.ts#L16-L38) (lines 16, 18, 28, 29, 38)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler treats a missing CRON_SECRET as a warning and proceeds. The default request is not a dry run, so an unauthenticated caller in an environment without CRON_SECRET can invoke autoCompletePastBookings. The traced job uses the service-role client across restaurants, transitions eligible bookings through check-in/check-out, clears table assignments, and enqueues side effects.

## Recommendation

Require CRON_SECRET for every invocation and fail closed when it is absent. Keep dryRun as an explicit operational mode, not a substitute for authentication.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
