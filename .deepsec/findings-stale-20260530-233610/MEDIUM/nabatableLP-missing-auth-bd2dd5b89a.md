# [MEDIUM] Assignment context fetch reaches a service-role route without handler-level auth

**File:** [`src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The hook fetches assignment context with bookingService.getAssignmentContext(bookingId). That service maps to GET /api/ops/bookings/{bookingId}/assignment-context. The route handler does not call supabase.auth.getUser(), requireMembershipForRestaurant(), or any equivalent handler-level authorization before using getServiceSupabaseClient() to load the booking, deriving restaurant_id from the supplied booking id, querying table inventory/bookings/assignments, and returning the context. Per the project rules, relying on Next.js proxy/middleware for /api/ops/\*\* is not a sufficient mitigation. An unauthenticated or cross-tenant caller who knows or obtains a booking UUID can retrieve operational table-assignment context and can also trigger the route's orphaned-assignment cleanup side effect.

## Recommendation

Add explicit auth in src/app/api/ops/bookings/[id]/assignment-context/route.ts: resolve the Supabase user, load the booking only enough to get restaurant_id, call requireMembershipForRestaurant({ userId, restaurantId }), and only then use the tenant/service client for context queries. Also make the contextBookings query explicitly filter by restaurant_id and move orphan cleanup out of this GET path or guard it behind the same authorization.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
