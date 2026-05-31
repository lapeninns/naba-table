# [HIGH] Assignment context can be read across restaurants

**File:** [`src/services/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/bookings.ts#L1017-L1018) (lines 1017, 1018)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getAssignmentContext() calls /api/ops/bookings/{bookingId}/assignment-context with only a booking ID. The corresponding route loads the booking using getServiceSupabaseClient() and never performs a route-handler session check or requireMembershipForRestaurant() before returning assignment context, tables, conflicts, and booking timing data. The outer proxy requireOpsAuth only proves the user has some restaurant membership, not membership in the booking's restaurant. An authenticated staff user from one restaurant who obtains another restaurant's booking UUID can read cross-tenant operational data.

## Recommendation

Add route-handler authentication to the assignment-context route, load the booking's restaurant_id, call requireMembershipForRestaurant() for that restaurant before any service-role reads, and return 404/403 on failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
