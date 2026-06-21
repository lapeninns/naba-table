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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
