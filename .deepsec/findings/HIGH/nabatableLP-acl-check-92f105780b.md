# [HIGH] Table assignment context uses a service-role endpoint without resource-level authorization

**File:** [`src/components/features/dashboard/booking-details/components/BookingDialogBody.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/components/BookingDialogBody.tsx#L179-L235) (lines 179, 180, 181, 233, 234, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

BookingDialogBody renders TableAssignmentPanel with booking.id and summary.restaurantId at lines 179-189 and 233-243. That panel calls bookingService.getAssignmentContext(bookingId), which reaches src/app/api/ops/bookings/[id]/assignment-context/route.ts. The route uses getServiceSupabaseClient() to load the booking and getTenantServiceSupabaseClient() to return table inventory, assignment, window, and conflict data, but it never calls requireSession(), requireRestaurantMember(), or checks restaurant_memberships in the route handler. The proxy-level requireOpsAuth only proves the caller has some restaurant membership, not membership for the booking's restaurant, and the project guidance explicitly says that is not sufficient. A staff user from one restaurant who obtains a booking UUID for another restaurant can request the assignment-context endpoint and receive cross-tenant operational seating data.

## Recommendation

Add in-handler authorization to src/app/api/ops/bookings/[id]/assignment-context/route.ts before any service-role reads: validate the booking UUID, requireSession(), load the booking's restaurant_id, then requireRestaurantMember() for that restaurant. Keep the service client only after authorization, explicitly filter context booking queries by restaurant_id, and add a cross-tenant denial test.

## Revalidation

**Verdict:** fixed

BookingDialogBody still renders TableAssignmentPanel with booking.id and summary.restaurantId, but the backend route reached by that panel has changed. The current src/app/api/ops/bookings/[id]/assignment-context/route.ts calls withBookingAuthorization(req, bookingId, { action: 'assignment-context:read' }) before constructing getServiceSupabaseClient() or getTenantServiceSupabaseClient(). withBookingAuthorization validates the booking id shape, resolves a session or trusted proxy user, loads the booking's restaurant_id, and requires membership for that exact restaurant. The shared loader then re-filters the service-role booking lookup with both id and restaurant_id, and the same-day context booking query is explicitly filtered by restaurant_id. A staff user from restaurant A with a booking UUID from restaurant B is blocked before the service-role context payload is produced. The vulnerable route behavior was patched in 020a7389 and later refactored into the shared loader in ee391753 without removing the authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
