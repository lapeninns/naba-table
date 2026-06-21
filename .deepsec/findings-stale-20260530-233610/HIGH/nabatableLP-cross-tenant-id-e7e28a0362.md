# [HIGH] Modification flow trusts caller-supplied restaurant_id

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L85-L92) (lines 85, 87, 92)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

beginBookingModificationFlow() receives existingBooking but builds pendingPayload by spreading the caller payload and persists it directly. The public full booking update path passes restaurant_id from data.restaurantId when table realignment is required, so a guest who can update their own booking can supply another restaurant UUID and move the booking into a different tenant using a service-role client. The subsequent clear/quote/confirm work then operates against the modified tenant context, enabling cross-tenant data corruption and capacity/table assignment impact.

## Recommendation

Do not accept restaurant_id from modification payloads. Derive it from existingBooking.restaurant_id inside the helper, or reject any payload restaurant_id that differs from existingBooking.restaurant_id. Also reject restaurantId changes at the route schema/handler boundary.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
