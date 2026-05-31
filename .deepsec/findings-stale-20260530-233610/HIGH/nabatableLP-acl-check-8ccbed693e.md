# [HIGH] Assignment context endpoint lacks handler-level tenant authorization

**File:** [`src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Line 45 calls bookingService.getAssignmentContext(bookingId), which maps to GET /api/ops/bookings/{id}/assignment-context. That route uses getServiceSupabaseClient() to load any booking by id, derives restaurant_id, returns booking metadata, table inventory, assignment state, and conflicting booking IDs, and can trigger orphaned-assignment cleanup, but it has no route-handler auth check and no requireMembershipForRestaurant check before service-role access. The proxy requireOpsAuth guard only proves some restaurant membership and is not sufficient per the repo contract. Any ops user who knows another tenant's booking UUID can read that tenant's assignment context; if middleware matching is missed, the handler itself has no fallback protection.

## Recommendation

Add handler-level auth in src/app/api/ops/bookings/[id]/assignment-context/route.ts: validate the booking id, resolve the Supabase user, load the booking, requireMembershipForRestaurant for booking.restaurant_id, and only then perform service-role or tenant-scoped reads and cleanup. Return 404/403 consistently for unauthorized access.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
