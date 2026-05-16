# [HIGH] Non-admin staff can modify table and zone settings

**File:** [`src/app/app/(app)/settings/restaurant/tables/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/tables/page.tsx#L12>) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table settings surface exposes add/edit table and zone actions for any active restaurant membership, and the backing /api/ops/tables and /api/ops/zones mutation handlers only verify that the user has some membership for the restaurant. They do not require owner/manager privileges. A host or server role can therefore change capacity, table status, zones, and seating configuration for their restaurant.

## Recommendation

Require requireAdminMembership, or an explicit table-settings permission, for table and zone create/update/delete handlers. Mirror the same permission in the client UI.

## Revalidation

**Verdict:** fixed

The client still exposes add/edit controls, but the server-side mutation paths no longer allow any restaurant member to write. `POST /api/ops/tables` wraps the handler in `withCsrfProtectedMutation`, loads the membership role for the target restaurant, and rejects non-owner/non-manager roles with `Insufficient permissions for table management`. `PATCH` and `DELETE /api/ops/tables/[id]` perform the same role check against the existing table's restaurant. `POST /api/ops/zones` and `PATCH`/`DELETE /api/ops/zones/[id]` also require `isRestaurantAdminRole(membership.role)`. A host/server can attempt the request, but the current backend returns 403 before mutation. This was patched in `020a7389 Apply security sprint fixes and staging migrations`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
