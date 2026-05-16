# [MEDIUM] Unbounded heatmap date range enables large tenant-wide scans

**File:** [`src/app/api/ops/dashboard/heatmap/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/dashboard/heatmap/route.ts#L12-L40) (lines 12, 13, 40)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route only validates that startDate and endDate match YYYY-MM-DD, then passes both values directly to getBookingsHeatmap with a service-role client. The helper selects every booking row in the requested range and aggregates in application code. Although requireDashboardAccess enforces restaurant membership, a malicious or compromised member account can request ranges spanning years to force large database scans and server-side processing, while the intended UI range is only a calendar window.

## Recommendation

Validate that startDate <= endDate and enforce a maximum range, such as the 42-day calendar range used by the UI or another documented cap. Prefer DB-side aggregation for heatmap counts and add rate limiting for repeated analytics calls.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
