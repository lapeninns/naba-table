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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
