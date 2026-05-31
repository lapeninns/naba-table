# [MEDIUM] Unbounded change-feed limit enables expensive service-role reads

**File:** [`src/app/api/ops/dashboard/changes/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/dashboard/changes/route.ts#L10-L46) (lines 10, 16, 30, 43, 44, 46)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The `limit` query parameter is validated only as digits, then parsed and passed directly into `getTodayBookingChanges`. The downstream helper uses the service-role client and applies that value to `.limit(limit)` while returning raw `oldData` and `newData` change payloads. An authenticated restaurant member can request extremely large limits repeatedly, producing expensive booking-version reads and large JSON responses without route-level throttling.

## Recommendation

Coerce and cap `limit` with a small maximum, reject non-finite parsed values, add per-user/per-restaurant rate limiting, and consider redacting raw change payload fields not needed by the dashboard.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
