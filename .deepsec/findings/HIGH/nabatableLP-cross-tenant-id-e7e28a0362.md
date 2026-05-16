# [HIGH] Modification flow trusts caller-supplied restaurant_id

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L85-L92) (lines 85, 87, 92)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

beginBookingModificationFlow() receives existingBooking but builds pendingPayload by spreading the caller payload and persists it directly. The public full booking update path passes restaurant_id from data.restaurantId when table realignment is required, so a guest who can update their own booking can supply another restaurant UUID and move the booking into a different tenant using a service-role client. The subsequent clear/quote/confirm work then operates against the modified tenant context, enabling cross-tenant data corruption and capacity/table assignment impact.

## Recommendation

Do not accept restaurant_id from modification payloads. Derive it from existingBooking.restaurant_id inside the helper, or reject any payload restaurant_id that differs from existingBooking.restaurant_id. Also reject restaurantId changes at the route schema/handler boundary.

## Revalidation

**Verdict:** fixed

The target helper still accepts `restaurant_id` in `UpdateBookingPayload`, but the currently exposed public path no longer lets an attacker choose a different tenant. The full self-serve update route checks `data.restaurantId` against `existingBooking.restaurant_id` and returns `RESTAURANT_LOCKED` on mismatch. It then calls `requireRestaurantContext(existingBooking.restaurant_id)` and passes that derived value as `restaurant_id`, so the request body value is not used for the update. The dashboard update route strips unknown fields through its schema and derives the restaurant from the existing booking, while the ops route uses `getTenantServiceSupabaseClient(existingBooking.restaurant_id)` and omits `restaurant_id` from the modification payload. I found no other live caller that passes untrusted `restaurant_id` into `beginBookingModificationFlow`. The reported guest cross-tenant mutation path is fixed, with the residual note that the helper should still enforce the invariant internally.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
