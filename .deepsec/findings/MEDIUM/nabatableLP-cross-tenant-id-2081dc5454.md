# [MEDIUM] Service-role confirm flow can be used as a cross-tenant booking oracle

**File:** [`src/app/api/staff/auto/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/confirm/route.ts#L37-L94) (lines 37, 69, 72, 74, 88, 93, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler verifies membership only for the restaurant on the supplied hold, then passes the user-controlled bookingId into confirmHold using a tenant service client. confirmHold loads that booking with service privileges before proving the user can access the booking's restaurant, and mismatch/errors are returned to the client through mapAssignTablesErrorToHttp or raw error.message. A staff user with a valid hold in their restaurant can distinguish nonexistent booking UUIDs from existing cross-tenant booking UUIDs and receive mismatch details such as the other booking's restaurant id.

## Recommendation

Before constructing the service client or calling confirmHold, load the submitted bookingId with the cookie-bound client, verify it exists, verify its restaurant_id equals the hold restaurant, and verify membership for that restaurant. Return a generic not-found/forbidden response for mismatches and do not expose RPC details to the caller.

## Revalidation

**Verdict:** fixed

`src/app/api/staff/auto/confirm/route.ts` now loads the submitted booking with the session-bound client after hold membership is established and returns `BOOKING_NOT_FOUND` if the booking is missing or belongs to a different restaurant. Service-role `confirmHold` is not called until that check passes. Covered by `tests/server/staff-auto-confirm-route-security.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
