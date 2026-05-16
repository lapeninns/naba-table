# [MEDIUM] Cross-tenant booking existence can be probed

**File:** [`src/app/api/ops/bookings/[id]/no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/no-show/route.ts#L43) (lines 43)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler passes the user-controlled booking id into loadLifecycleRouteContext. That helper loads the booking with the service-role Supabase client before checking requireMembershipForRestaurant, then returns different outcomes for missing bookings versus bookings belonging to another restaurant. An authenticated member of any restaurant who has or guesses a booking id can distinguish nonexistent ids from cross-tenant bookings.

## Recommendation

Load bookings through an RLS-enforced tenant/session client, or collapse unauthorized and missing bookings to the same response. If service-role lookup is unavoidable, perform an atomic membership-scoped lookup/RPC and avoid returning booking-specific errors before authorization.

## Revalidation

**Verdict:** fixed

`loadLifecycleRouteContext` now returns `Booking not found` for bookings that exist but fail per-restaurant membership authorization, matching the missing-booking response before lifecycle checks proceed. Covered by `tests/server/ops-booking-lifecycle-context-security.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
