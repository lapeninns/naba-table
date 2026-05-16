# [MEDIUM] Unbounded heatmap date range can force large booking scans

**File:** [`server/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/bookings.ts#L585-L604) (lines 585, 591, 594, 595, 596, 604)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getBookingsHeatmap reads every booking between caller-supplied startDate and endDate, then aggregates in application memory. The traced /api/ops/dashboard/heatmap route only validates YYYY-MM-DD shape and has no maximum range or rate limit, so any authenticated member of the restaurant can repeatedly request multi-year ranges and force large service-role database reads and JSON processing.

## Recommendation

Validate real dates, require startDate <= endDate, cap the maximum range to the UI's expected calendar window, add route-level rate limiting, and consider aggregating in SQL rather than loading all rows into application memory.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
