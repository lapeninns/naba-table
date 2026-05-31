# [MEDIUM] Authorization happens after service-role booking and lifecycle checks

**File:** [`src/app/api/ops/bookings/[id]/status/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/status/route.ts#L81-L124) (lines 81, 98, 110, 124)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route loads the user-controlled booking id with getServiceSupabaseClient, loads the restaurant, and performs the lifecycle-date check before checking whether the user belongs to bookingRow.restaurant_id. This creates a cross-tenant oracle: nonexistent ids return 404, existing cross-tenant bookings outside the allowed lifecycle window return 409, and existing cross-tenant bookings inside the window reach the later 403.

## Recommendation

Move membership verification before any booking-specific validation response. Prefer an RLS/session-client lookup or a membership-scoped RPC; otherwise normalize not-found and forbidden responses so cross-tenant callers cannot distinguish booking existence or timing.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
