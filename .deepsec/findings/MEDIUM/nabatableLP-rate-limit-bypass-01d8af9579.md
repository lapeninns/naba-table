# [MEDIUM] Unbounded status summary query can be abused for repeated full-history scans

**File:** [`src/app/api/ops/bookings/status-summary/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/status-summary/route.ts#L22-L105) (lines 22, 24, 28, 32, 99, 100, 105)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route authenticates the user and checks membership for the requested restaurant, but the query schema leaves `from` and `to` optional and does not cap the date range or the `statuses` list. It then calls `getBookingStatusSummary` with those attacker-controlled filters. That helper uses the service-role client by default, selects every matching booking status for the restaurant, and counts in application code. An authenticated restaurant member can omit dates or request very large ranges repeatedly, causing expensive database/API work without any `consumeRateLimit` protection.

## Recommendation

Apply a per-user/per-restaurant rate limit, enforce a bounded maximum date window and status count, and move the count into a bounded database aggregation/RPC instead of loading all matching rows into the route.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
