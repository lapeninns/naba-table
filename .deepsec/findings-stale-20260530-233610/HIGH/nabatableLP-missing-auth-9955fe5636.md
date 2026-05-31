# [HIGH] Auto-complete cron job can run unauthenticated when CRON_SECRET is unset

**File:** [`server/jobs/auto-complete-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/jobs/auto-complete-bookings.ts#L274-L468) (lines 274, 279, 283, 414, 446, 452, 468)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The job is invoked by src/app/api/cron/auto-complete-bookings/route.ts, whose handler logs and proceeds when CRON_SECRET is unset before calling autoCompletePastBookings. This target function then uses the service-role Supabase client, enumerates restaurants, accepts the caller-provided limit without an upper bound, and performs booking state transitions, table-assignment clearing, and side-effect scheduling. If CRON_SECRET is missing in a deployed environment, an unauthenticated GET to the cron route can mutate booking state across tenants and amplify resource usage by raising limit.

## Recommendation

Make the cron route fail closed when CRON_SECRET is missing or empty, returning 401/500 before calling this job. Also cap limit to a safe maximum and consider moving cron secret access through the validated env layer.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
