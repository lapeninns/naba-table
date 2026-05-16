# [MEDIUM] Assignment context fetch reaches a service-role route without handler-level auth

**File:** [`src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The hook fetches assignment context with bookingService.getAssignmentContext(bookingId). That service maps to GET /api/ops/bookings/{bookingId}/assignment-context. The route handler does not call supabase.auth.getUser(), requireMembershipForRestaurant(), or any equivalent handler-level authorization before using getServiceSupabaseClient() to load the booking, deriving restaurant_id from the supplied booking id, querying table inventory/bookings/assignments, and returning the context. Per the project rules, relying on Next.js proxy/middleware for /api/ops/\*\* is not a sufficient mitigation. An unauthenticated or cross-tenant caller who knows or obtains a booking UUID can retrieve operational table-assignment context and can also trigger the route's orphaned-assignment cleanup side effect.

## Recommendation

Add explicit auth in src/app/api/ops/bookings/[id]/assignment-context/route.ts: resolve the Supabase user, load the booking only enough to get restaurant_id, call requireMembershipForRestaurant({ userId, restaurantId }), and only then use the tenant/service client for context queries. Also make the contextBookings query explicitly filter by restaurant_id and move orphan cleanup out of this GET path or guard it behind the same authorization.

## Revalidation

**Verdict:** fixed

The hook still calls bookingService.getAssignmentContext(bookingId), but the endpoint it reaches now has handler-level authorization. The current assignment-context route calls withBookingAuthorization before any service-role client is created. withBookingAuthorization requires a valid booking id, a session or trusted proxy-authenticated user, and membership for the booking's restaurant. The loader then performs the service-role booking read with an explicit restaurant_id filter and scopes contextBookings to the same restaurant id. Orphan cleanup is still present but is behind the same authorization path. A caller with no session or with membership only in another restaurant cannot obtain the assignment context by supplying a victim booking UUID.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
