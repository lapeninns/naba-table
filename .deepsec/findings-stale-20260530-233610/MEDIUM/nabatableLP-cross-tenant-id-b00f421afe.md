# [MEDIUM] Service-role booking mutations are not constrained by restaurant_id

**File:** [`src/app/api/ops/bookings/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/route.ts#L623-L1020) (lines 623, 646, 1017, 1020)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH and DELETE authorize the user against existingBooking.restaurant_id from a prior service-role read, but the actual non-realignment PATCH calls updateBookingRecord(tenantClient, bookingId, ...) without its restaurantId option, and DELETE calls softCancelBooking(tenantClient, bookingId). getTenantServiceSupabaseClient only adds a tenant context header and still bypasses RLS, so these mutations are by user-controlled bookingId only. If the booking tenant changes between the authorization read and mutation, a member authorized for the old restaurant can update or cancel a booking outside their tenant.

## Recommendation

Carry the authorized restaurant_id into the mutation predicate. Pass { restaurantId: existingBooking.restaurant_id } to updateBookingRecord, add a restaurant-constrained soft-cancel helper/RPC, and prefer a single transaction/RPC that verifies tenant and mutates atomically.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-11)
