# [HIGH] Fail-open cron route exposes service-role booking completion

**File:** [`server/jobs/auto-complete-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/jobs/auto-complete-bookings.ts#L274-L451) (lines 274, 279, 283, 344, 390, 451)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-cron-auth-fail-open`

## Owners

**Suggested assignee:** `230744634+lapeninns@users.noreply.github.com` _(via last-committer)_

## Finding

autoCompletePastBookings is a sensitive service-role job: it creates a service client, iterates all restaurants, applies check-in/check-out transitions, clears table assignments, and schedules checkout side effects. Its HTTP caller at src/app/api/cron/auto-complete-bookings/route.ts only checks the bearer token when CRON_SECRET is set and otherwise logs a warning and proceeds. In any environment where CRON_SECRET is missing, an unauthenticated GET can trigger cross-tenant booking state changes. The job also accepts an uncapped limit option from the route, increasing abuse impact.

## Recommendation

Make the cron route fail closed when CRON_SECRET is unset or empty, cap the accepted limit, and keep this job callable only from authenticated cron infrastructure.

## Revalidation

**Verdict:** fixed

The current cron route fails closed before reaching the service-role booking completion job. GET /api/cron/auto-complete-bookings delegates to requireCronAuthAndRun, and requireCronAuth returns 503 when no cron secret is configured instead of logging a warning and continuing. The same helper rejects missing or invalid bearer tokens with 401, enforces a cron rate limit, and prevents concurrent execution for the same job name. The route also clamps limit to a maximum of 200, so the uncapped request-amplification part of the finding is no longer present at the HTTP boundary. autoCompletePastBookings itself still trusts its options and uses getServiceSupabaseClient, but it is an internal job function and the live route now guards it correctly. This makes the described unauthenticated cross-tenant booking mutation path fixed in the current code.

## Recent committers (`git log`)

- lapeninns <230744634+lapeninns@users.noreply.github.com> (2026-05-15)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
