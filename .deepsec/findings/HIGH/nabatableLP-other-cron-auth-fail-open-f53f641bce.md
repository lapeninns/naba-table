# [HIGH] Fail-open cron route exposes service-role booking completion

**File:** [`server/jobs/auto-complete-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/jobs/auto-complete-bookings.ts#L274-L451) (lines 274, 279, 283, 344, 390, 451)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-cron-auth-fail-open`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

autoCompletePastBookings is a sensitive service-role job: it creates a service client, iterates all restaurants, applies check-in/check-out transitions, clears table assignments, and schedules checkout side effects. Its HTTP caller at src/app/api/cron/auto-complete-bookings/route.ts only checks the bearer token when CRON_SECRET is set and otherwise logs a warning and proceeds. In any environment where CRON_SECRET is missing, an unauthenticated GET can trigger cross-tenant booking state changes. The job also accepts an uncapped limit option from the route, increasing abuse impact.

## Recommendation

Make the cron route fail closed when CRON_SECRET is unset or empty, cap the accepted limit, and keep this job callable only from authenticated cron infrastructure.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
