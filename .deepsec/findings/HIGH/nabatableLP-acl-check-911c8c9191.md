# [HIGH] Any restaurant member can modify table inventory

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L96-L223) (lines 96, 103, 151, 199, 223)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH only checks that the authenticated user has some membership in the table's restaurant, then allows updates to sensitive table inventory fields including capacity, min/max party size, zoneId, active, status, position, notes, and maintenance allocation. Lower-privileged roles such as host/server can directly call this endpoint and alter capacity or mark tables out of service, even though table inventory is restaurant settings data and should be owner/manager controlled.

## Recommendation

Use requireAdminMembership or requireMembershipForRestaurant with RESTAURANT_ADMIN_ROLES before applying inventory configuration changes. If hosts/servers need status-only operations, split those into a separate endpoint with a narrow schema and explicit role policy.

## Revalidation

**Verdict:** fixed

The current PATCH handler authenticates the user, fetches the table, loads the caller's membership for that table's restaurant, and now explicitly checks isRestaurantAdminRole(membership.role). That shared role helper only accepts owner and manager, so host and server memberships are denied before any table fields are parsed into updatePayload or passed to updateTableRecord. The route is also wrapped in withCsrfProtectedMutation. The same 20260505141000 RLS hardening migration adds restrictive table_inventory write policies for owner/manager roles, which closes the direct Supabase write path as well. A lower-privileged restaurant member can no longer use this endpoint to change capacity, zones, active state, status, notes, or maintenance allocation in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
