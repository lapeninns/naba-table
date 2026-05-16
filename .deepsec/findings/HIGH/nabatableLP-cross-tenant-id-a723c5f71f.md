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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
