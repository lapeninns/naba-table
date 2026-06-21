# [MEDIUM] Unbounded service-period replacement can amplify database work

**File:** [`src/app/api/onboarding/restaurant/[id]/service-periods/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/onboarding/restaurant/[id]/service-periods/route.ts#L22-L52) (lines 22, 23, 51, 52)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route is protected by backend restaurant authorization and CSRF, so this is not missing auth. However, the request schema accepts an unbounded servicePeriods array with unbounded string fields, then passes the full array to a service-role replacement RPC. Any authenticated owner/manager for a restaurant can submit a very large payload that forces Postgres to parse a large jsonb recordset, replace many rows, and make later schedule logic process excessive service-period data. There is no per-user or per-tenant rate limit on this mutation.

## Recommendation

Add a per-user/per-restaurant rate limit, cap the number of service periods to the product maximum, cap string lengths, and enforce the same bounds in the service/RPC layer.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
