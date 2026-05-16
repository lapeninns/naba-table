# [HIGH] Booking update helper permits restaurant_id reassignment by booking id only

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings.ts#L64-L463) (lines 64, 65, 440, 460, 462, 463)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

UpdateBookingPayload includes restaurant_id, and updateBookingRecord() blindly spreads the payload into an update constrained only by booking id. The public booking update route passes restaurant_id from data.restaurantId ?? existingBooking.restaurant_id after checking only booking contact ownership, not equality with the existing restaurant. A user who controls a booking can move that booking row into another tenant restaurant_id, corrupting another restaurant's bookings/capacity data.

## Recommendation

Remove restaurant_id from generic update payloads or reject restaurant changes by default. For booking mutations, require the expected existing restaurant id and update with both id and restaurant_id predicates; any legitimate transfer should require explicit admin authorization.

## Revalidation

**Verdict:** fixed

The specific exploitable path described in the finding has been patched. `updateBookingRecord` now accepts an optional `{ restaurantId }` guard and adds `.eq('restaurant_id', options.restaurantId)` when provided. The public booking update route now rejects a `data.restaurantId` that differs from `existingBooking.restaurant_id`, derives `restaurantId` from the existing booking, and calls `updateBookingRecord(..., { restaurantId })`. `beginBookingModificationFlow` also passes the existing booking's restaurant id as the guard. The helper type still allows `restaurant_id` in a payload, so there is residual defense-in-depth risk if a future caller omits the guard, but I did not find a current user-controlled route that can reassign a booking across tenants through this helper.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
