# [HIGH] Modification flow trusts caller-supplied restaurant_id under service role

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L87-L142) (lines 87, 88, 92, 142)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

beginBookingModificationFlow builds pendingPayload by spreading the caller-provided payload and then updates the booking through the supplied client. In the public full-update caller, that client is a service-role client and payload.restaurant_id can come from the request body when table realignment is required. Because this helper receives existingBooking but never checks that payload.restaurant_id matches existingBooking.restaurant_id, a guest who can modify their own booking can submit another public restaurant UUID and move the booking into another tenant before auto-assignment runs, causing cross-tenant data pollution and potential table holds/assignments in the victim restaurant.

## Recommendation

Do not accept restaurant_id from modification payloads. Derive the restaurant id from existingBooking.restaurant_id, reject any mismatch, and constrain updates with both id and the original restaurant_id. Prefer a tenant-scoped client for the existing restaurant and add regression tests for public booking updates that include a different restaurantId.

## Revalidation

**Verdict:** fixed

The helper still spreads `payload` into `pendingPayload`, so the helper itself would remain safer if it explicitly rejected a mismatched `restaurant_id`. However, I traced the current exposed callers and the concrete public attack described in the finding is blocked now. In `src/app/api/bookings/[id]/route.ts`, the full-update path rejects a body `restaurantId` that differs from `existingBooking.restaurant_id` before building the modification payload, and then derives `restaurantId` from the existing booking rather than trusting the request body. The dashboard-format public path has no `restaurantId` in its schema, and the ops route calls the helper with a tenant-scoped client and no `restaurant_id` in the payload. Session-recovery lookups are also constrained to the token restaurant and booking contact before update. The original cross-tenant route-level exploit is therefore patched in current code, though moving the invariant into the helper would still be good defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
