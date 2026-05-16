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

## Revalidation

**Verdict:** fixed

The current assignment-context route no longer matches the reported unauthenticated service-role read. src/app/api/ops/bookings/[id]/assignment-context/route.ts first calls withBookingAuthorization(req, bookingId, { action: 'assignment-context:read' }). That guard validates the session, loads the booking’s restaurant_id, and calls requireRestaurantMember for that restaurant before the handler creates service-role clients. The payload loader is then called with the authorized restaurantId and re-filters the booking lookup with .eq('restaurant_id', restaurantId). Tenant-scoped reads use getTenantServiceSupabaseClient(restaurantId) for tables, conflicts, holds, and assignments. A user from another restaurant who supplies a foreign booking UUID will be stopped by the route-level booking authorization and should receive a 403/404 rather than assignment context. This change is part of the 020a7389 security sprint patch. The original cross-tenant read path is no longer exploitable in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
