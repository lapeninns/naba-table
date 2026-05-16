# [HIGH] Service-role assignment context endpoint has no backend auth or restaurant authorization

**File:** [`src/app/api/ops/bookings/[id]/assignment-context/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/assignment-context/route.ts#L20-L167) (lines 20, 25, 32, 35, 51, 66, 131, 167)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler accepts an arbitrary booking id from the route, immediately uses getServiceSupabaseClient() to read the booking, derives restaurant_id from that row, then returns booking metadata, table inventory, conflicts, assignments, and timing context. It never calls requireSession(), requireMembershipForRestaurant(), requireRestaurantMember(), or any equivalent backend authorization check. Even if src/proxy.ts normally applies requireOpsAuth to /api/ops/\*, that middleware only proves the caller has some restaurant membership and does not authorize access to the target booking's restaurant; per the project contract, route handlers must enforce resource-level membership themselves. The same unauthenticated path can also trigger cleanupOrphanedAssignments() from this GET handler, causing service-role deletes of orphaned assignment records for the supplied booking.

## Recommendation

Add backend auth inside the route: validate the booking id, require a Supabase session, load the booking through an authenticated/RLS client or perform a minimal service lookup only after a safe authorization design, then call requireMembershipForRestaurant/requireRestaurantMember for the resolved restaurant before any service-role reads or cleanup. Move cleanup side effects behind an authenticated mutation path or only run them after authorization.

## Revalidation

**Verdict:** fixed

The endpoint now has backend auth in the route itself, not just proxy-level ops auth. withBookingAuthorization uses withOpsMutation, which either trusts the proxy-set x-ops-user-id header or falls back to requireSession when the header is absent, so direct route access still needs a valid Supabase session. It then resolves the booking's restaurant and calls requireRestaurantMember for that restaurant. If the caller is not a member, the route returns before service-role reads, rate-limited context loading, or cleanup side effects. The current route also rate-limits by the authorized restaurantId and userId. Therefore the missing-auth and cross-tenant service-role read described in the finding is no longer present.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-03)
