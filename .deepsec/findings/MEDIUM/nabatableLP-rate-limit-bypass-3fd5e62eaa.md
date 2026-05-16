# [MEDIUM] Unbounded change-feed limit returns large raw history payloads

**File:** [`server/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/bookings.ts#L626-L686) (lines 626, 631, 658, 668, 685, 686)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getTodayBookingChanges accepts options.limit and passes it directly to the service-role booking_versions query while returning raw oldData and newData payloads. The traced /api/ops/dashboard/changes route accepts any digit-only limit string and has no rate limit, allowing a restaurant member to request very large change feeds repeatedly, causing heavy database reads, response serialization, and exposure of far more historical PII/change data than the dashboard needs.

## Recommendation

Clamp limit to a small server-side maximum, reject non-finite or excessive values, add route-level rate limiting, and avoid returning raw old_data/new_data unless the caller has a specific authorized need.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
