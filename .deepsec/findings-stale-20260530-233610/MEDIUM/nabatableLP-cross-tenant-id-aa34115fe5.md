# [MEDIUM] Service-role booking lookup leaks cross-tenant booking existence

**File:** [`src/app/api/ops/bookings/[id]/history/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/history/route.ts#L43-L64) (lines 43, 47, 56, 61, 64)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler authenticates the caller, then loads the user-controlled booking id with the service-role client before checking restaurant membership. A missing booking returns 404 at line 57, while an existing booking in another tenant reaches the membership check and returns 403 at line 64. An authenticated member of any restaurant who obtains or tests booking UUIDs can distinguish nonexistent ids from valid cross-tenant booking ids. The route also has no per-user probing limit.

## Recommendation

Use the shared booking authorization guard or an RLS/membership-scoped lookup so unauthorized and missing bookings collapse to the same response. Add a per-user/per-tenant rate limit before service-role history reads.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
