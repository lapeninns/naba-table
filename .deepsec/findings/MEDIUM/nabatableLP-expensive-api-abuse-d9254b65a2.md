# [MEDIUM] Unbounded change-feed limit enables authenticated resource exhaustion

**File:** [`src/app/api/ops/dashboard/changes/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/dashboard/changes/route.ts#L16-L44) (lines 16, 43, 44)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts any digit-only limit value, parses it, and passes it to getTodayBookingChanges without an upper bound. That helper uses the value in a service-role Supabase query against booking_versions and returns old_data/new_data payloads. Any authenticated member of the restaurant can request very large limits repeatedly, forcing large database reads, application memory use, and response serialization for a dashboard endpoint that normally needs only a small recent-change feed.

## Recommendation

Coerce and clamp limit to a small maximum such as 100 or 200, reject non-finite/unsafe values, and add per-user or per-restaurant rate limiting for dashboard analytics endpoints.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
