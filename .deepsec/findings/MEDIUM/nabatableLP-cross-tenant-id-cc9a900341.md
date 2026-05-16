# [MEDIUM] Cross-tenant booking existence can be probed

**File:** [`src/app/api/ops/bookings/[id]/undo-no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/undo-no-show/route.ts#L41) (lines 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route delegates the user-controlled booking id to loadLifecycleRouteContext, which uses the service-role client to load the booking before checking restaurant membership. This prevents unauthorized mutation, but still lets an authenticated user distinguish nonexistent booking ids from existing bookings in other tenants by observing 404 versus 403.

## Recommendation

Use a membership-scoped/RLS-enforced booking lookup, or return the same response for missing and unauthorized bookings after service-role lookup.

## Revalidation

**Verdict:** fixed

`loadLifecycleRouteContext` now returns `Booking not found` for bookings that exist but fail per-restaurant membership authorization, matching the missing-booking response before lifecycle checks proceed. Covered by `tests/server/ops-booking-lifecycle-context-security.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
