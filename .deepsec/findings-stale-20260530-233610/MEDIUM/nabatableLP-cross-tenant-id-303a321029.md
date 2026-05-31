# [MEDIUM] Confirmation cache lookup runs before hold and tenant validation

**File:** [`server/capacity/table-assignment/assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/capacity/table-assignment/assignment.ts#L292-L300) (lines 292, 296, 299, 300)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

confirmHoldAssignment returns cached confirmation results before it loads the hold, checks hold.booking_id against the submitted bookingId, or verifies the hold restaurant matches the booking restaurant. The reachable /api/staff/auto/confirm route authorizes the caller only for the supplied hold's restaurant, then passes user-controlled bookingId and idempotencyKey into this service-role path. loadCachedConfirmationResult queries booking_confirmation_results and booking_table_assignments by bookingId plus idempotencyKey and, when an idempotency key is present, does not bind the cache hit to holdId or restaurant_id. Several auto-assignment flows use predictable keys derived from the booking id, such as inline-${bookingId}, api-${bookingId}, or auto-${bookingId}. An authenticated member of restaurant A with any valid hold can therefore submit a known booking UUID from restaurant B with the predictable idempotency key and receive cached assignment/table identifiers before the mismatch checks later in this function can run.

## Recommendation

Move the cached confirmation lookup after hold loading and booking/restaurant validation, and make the cache query require booking_id, hold_id, and restaurant_id together. Treat idempotency keys as replay controls, not authorization secrets, and ensure the staff confirm route verifies the submitted booking belongs to the authorized hold restaurant before calling service-role code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
