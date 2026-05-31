# [MEDIUM] Assignment error mapper leaks internal and cross-tenant details

**File:** [`src/app/api/staff/_utils/assign-tables-error.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/_utils/assign-tables-error.ts#L30-L34) (lines 30, 31, 33, 34)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

mapAssignTablesErrorToHttp returns AssignTablesRpcError.message, details, and hint directly to the client. The reachable /api/staff/auto/confirm route authorizes the caller against the hold's restaurant, then confirmHoldAssignment loads the caller-supplied bookingId using a service-role tenant client before checking whether the booking belongs to the hold's restaurant. On mismatch, confirmHoldAssignment builds an error whose details include bookingRestaurantId and holdRestaurantId; this mapper returns those details verbatim. An authenticated member of one restaurant with a valid hold can therefore submit an arbitrary booking UUID and distinguish nonexistent bookings from bookings in another tenant, leaking the other restaurant id. The same mapper also exposes raw RPC/PostgREST details and hints for repository errors.

## Recommendation

Do not return internal details or hints from AssignTablesRpcError to clients. Use generic client-safe messages for HOLD_RESTAURANT_MISMATCH and server/RPC errors, log full details server-side only, and validate the submitted booking belongs to the same restaurant with a user/RLS-bound lookup before any service-role read.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-14)
