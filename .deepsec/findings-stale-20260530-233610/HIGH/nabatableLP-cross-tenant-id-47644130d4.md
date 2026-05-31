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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
