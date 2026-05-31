# [MEDIUM] Service-role booking lookup can disclose cross-tenant booking existence and tenant IDs

**File:** [`src/app/api/staff/auto/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/staff/auto/confirm/route.ts#L47-L96) (lines 47, 65, 77, 80, 96)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route authorizes the caller only against the restaurant attached to the supplied holdId, then creates a tenant service client for that hold restaurant and passes the user-controlled bookingId into confirmHold. The downstream confirmHoldAssignment path loads the booking with the service-role client before rejecting a restaurant mismatch, and the route returns mapped AssignTablesRpcError payloads to the client. For a staff user with access to restaurant A and a valid hold in A, submitting a known booking UUID from restaurant B can distinguish nonexistent bookings from existing cross-tenant bookings and can return mismatch details containing bookingRestaurantId/holdRestaurantId. This is a cross-tenant IDOR-style information disclosure even though the later mismatch check blocks the assignment mutation.

## Recommendation

Before calling confirmHold, load the booking through an explicit tenant predicate such as id = bookingId and restaurant_id = holdRow.restaurant_id, and return a generic 404/403 on failure. Also move any cached-confirmation lookup until after the hold/booking tenant check, and do not return raw mismatch details, database details, or internal hints to clients.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
