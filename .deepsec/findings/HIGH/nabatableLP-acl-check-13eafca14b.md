# [HIGH] Non-admin restaurant members can mutate table and zone settings

**File:** [`src/app/app/(app)/settings/restaurant/tables/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/tables/page.tsx#L11-L12>) (lines 11, 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page renders the tables settings client for any restaurant membership. The client only gates table deletion in UI, but create/update table and create/update/delete zone mutations are available to any active member. The backing route handlers also only check that the user has a membership, not that the role is owner/manager: src/app/api/ops/tables/route.ts checks membership at lines 140-149 before allowing POST, src/app/api/ops/tables/[id]/route.ts checks membership at lines 96-105 before allowing PATCH, and src/app/api/ops/zones/route.ts plus src/app/api/ops/zones/[id]/route.ts do the same for zone mutations. Since roles are owner, manager, host, and server, a host/server can change capacity-affecting restaurant settings and take tables/zones out of service.

## Recommendation

Require requireAdminMembership or requireMembershipForRestaurant with owner/manager roles on all table and zone mutation handlers, and hide or disable mutation controls when permissions.canManageSettings is false.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
