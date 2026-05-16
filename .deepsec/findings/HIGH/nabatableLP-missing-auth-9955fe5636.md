# [HIGH] Auto-complete cron job can run unauthenticated when CRON_SECRET is unset

**File:** [`server/jobs/auto-complete-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/jobs/auto-complete-bookings.ts#L274-L468) (lines 274, 279, 283, 414, 446, 452, 468)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `230744634+lapeninns@users.noreply.github.com` _(via last-committer)_

## Finding

The job is invoked by src/app/api/cron/auto-complete-bookings/route.ts, whose handler logs and proceeds when CRON_SECRET is unset before calling autoCompletePastBookings. This target function then uses the service-role Supabase client, enumerates restaurants, accepts the caller-provided limit without an upper bound, and performs booking state transitions, table-assignment clearing, and side-effect scheduling. If CRON_SECRET is missing in a deployed environment, an unauthenticated GET to the cron route can mutate booking state across tenants and amplify resource usage by raising limit.

## Recommendation

Make the cron route fail closed when CRON_SECRET is missing or empty, returning 401/500 before calling this job. Also cap limit to a safe maximum and consider moving cron secret access through the validated env layer.

## Revalidation

**Verdict:** fixed

The service-role job still performs sensitive cross-tenant booking transitions, but the current HTTP route no longer fails open. src/app/api/cron/auto-complete-bookings/route.ts now wraps execution in requireCronAuthAndRun instead of checking CRON_SECRET inline and proceeding when it is absent. server/security/cron-auth.ts builds the allowed secret list from CRON_SECRETS, CRON_SECRET, and CRON_SECRET_PREVIOUS, and if the list is empty it returns a 503 response before the job callback is invoked. If a bearer token is missing or wrong, the helper returns 401, and it also applies rate limiting and an in-process execution lock. The route caps the caller-supplied limit with MAX_LIMIT = 200 and caps windowMinutes at 180 before calling autoCompletePastBookings. A code search found the cron route as the live caller of autoCompletePastBookings. The unauthenticated fail-open route behavior described by the finding is therefore patched.

## Recent committers (`git log`)

- lapeninns <230744634+lapeninns@users.noreply.github.com> (2026-05-15)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
