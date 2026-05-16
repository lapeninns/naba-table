# [HIGH] Service-role assignment context lacks per-restaurant authorization

**File:** [`src/app/api/ops/bookings/[id]/assignment-context/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/assignment-context/route.ts#L20-L181) (lines 20, 25, 32, 35, 50, 66, 120, 131, 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler takes the route `bookingId` and immediately uses `getServiceSupabaseClient()` to load the booking, then derives `restaurant_id` and uses a tenant service-role client to load table inventory, same-day bookings, assignments, and conflict state. It never calls `requireSession`, `requireRestaurantMember`, or `requireMembershipForRestaurant` inside the route. The only traced protection is the `/api/ops/**` proxy guard, which only proves the user has some restaurant membership and is not a resource-level backend guard. An ops user from one restaurant who obtains another restaurant's booking UUID can request this endpoint and read that tenant's assignment context. The GET path can also trigger `cleanupOrphanedAssignments()` with the service client, making the unauthorized path capable of background deletes for detected orphaned assignment rows.

## Recommendation

Validate the booking id, authenticate in the route handler, load the booking in a way that allows determining its restaurant, and call `requireMembershipForRestaurant` or `requireRestaurantMember` for that restaurant before any service-role reads or cleanup. Keep every service-role query explicitly scoped by `restaurant_id`, and avoid mutating cleanup work from an unguarded GET path.

## Revalidation

**Verdict:** fixed

The current route starts by calling withBookingAuthorization(req, bookingId) and returns immediately if authorization fails. That guard validates the booking UUID, establishes a backend session, looks up the booking restaurant id, and then requires restaurant membership for that restaurant before the route creates any service-role clients. The service and tenant service clients are created only after authorization succeeds, and loadAssignmentContextPayload receives the authorized restaurantId. Inside the shared loader, the service-role booking lookup is also constrained by both bookingId and restaurantId. cleanupOrphanedAssignments can still run, but only after the route-level booking authorization has succeeded. This was patched in 020a7389 and the later loader refactor preserved the authorization-first flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-03)
