# [HIGH] Assignment context endpoint lacks handler-level tenant authorization

**File:** [`src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 45 calls bookingService.getAssignmentContext(bookingId), which maps to GET /api/ops/bookings/{id}/assignment-context. That route uses getServiceSupabaseClient() to load any booking by id, derives restaurant_id, returns booking metadata, table inventory, assignment state, and conflicting booking IDs, and can trigger orphaned-assignment cleanup, but it has no route-handler auth check and no requireMembershipForRestaurant check before service-role access. The proxy requireOpsAuth guard only proves some restaurant membership and is not sufficient per the repo contract. Any ops user who knows another tenant's booking UUID can read that tenant's assignment context; if middleware matching is missed, the handler itself has no fallback protection.

## Recommendation

Add handler-level auth in src/app/api/ops/bookings/[id]/assignment-context/route.ts: validate the booking id, resolve the Supabase user, load the booking, requireMembershipForRestaurant for booking.restaurant_id, and only then perform service-role or tenant-scoped reads and cleanup. Return 404/403 consistently for unauthorized access.

## Revalidation

**Verdict:** fixed

The current route no longer lacks tenant authorization. src/app/api/ops/bookings/[id]/assignment-context/route.ts runs withBookingAuthorization(req, bookingId, { action: 'assignment-context:read' }) first and returns its failure response before calling getServiceSupabaseClient(). The authorization helper loads the booking's restaurant_id and requires restaurant membership for that exact tenant. The service-role loader is also constrained with .eq('restaurant_id', restaurantId) on the target booking and on the same-day context booking query. This means a tenant A staff user who knows a tenant B booking id cannot reach the table inventory, conflicts, assignment state, or cleanup side effect for tenant B. Commit 020a7389 added the route-level authorization, and ee391753 preserved it while moving the payload shaping into dialogLoaders.ts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
