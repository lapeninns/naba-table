# [MEDIUM] Unbounded heatmap date range can force large booking scans

**File:** [`src/app/api/ops/dashboard/heatmap/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/dashboard/heatmap/route.ts#L10-L43) (lines 10, 12, 13, 27, 39, 40, 42, 43)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The heatmap route only checks that `startDate` and `endDate` match a date-shaped regex. It does not validate real dates, ordering, or a maximum range before calling `getBookingsHeatmap` with a service-role client. That helper loads all matching bookings for the restaurant and reduces them in application code. A restaurant member can request years of data repeatedly, causing unnecessary database and API memory load without `consumeRateLimit` protection.

## Recommendation

Validate dates semantically, enforce `startDate <= endDate`, cap the maximum range, aggregate heatmap counts in the database, and add a per-user/per-restaurant rate limit.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
