# [HIGH] Table assignment context is fetched from a service-role endpoint without route-handler authorization

**File:** [`src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx#L80) (lines 80)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

TableAssignmentPanel calls useTableAssignment, which fetches /api/ops/bookings/{bookingId}/assignment-context. Tracing that API route shows it takes the route bookingId, immediately uses getServiceSupabaseClient() to load the booking, derives restaurantId, then uses a tenant service client to return booking, table inventory, conflicts, and assignment data. The route handler does not call requireSession, requireRestaurantMember, requireMembershipForRestaurant, or getUser before the service-role read. The only apparent guard is src/proxy.ts requireOpsAuth, which the project explicitly says is not sufficient because it only proves some restaurant membership and middleware is not a handler-level authorization boundary. An attacker with any ops membership who learns or guesses another booking UUID can request another tenant's assignment context; if middleware is missed or bypassed, the handler itself has no authentication guard. The route also performs orphan cleanup from this unauthenticated GET path.

## Recommendation

Fix the assignment-context route, not the UI: validate the booking UUID, require a route-handler session, load the booking enough to identify restaurant_id, require membership for that exact restaurant before any service-role query, and only then use getTenantServiceSupabaseClient. Do not run orphan cleanup before authorization.

## Revalidation

**Verdict:** fixed

The current API route contradicts the reported route-handler behavior. src/app/api/ops/bookings/[id]/assignment-context/route.ts now begins with withBookingAuthorization and returns immediately on failure. Only after that does it create the service-role and tenant service clients. The shared loader verifies the target booking belongs to authorization.restaurantId and filters all table and same-day booking reads by that same restaurant id. The cleanupOrphanedAssignments side effect still happens from the GET loader, but only after the same booking authorization and tenant scoping have succeeded. If middleware were not considered, the handler still has its own session and membership authorization path through withBookingAuthorization. The reported unauthenticated or cross-tenant service-role read is therefore patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
