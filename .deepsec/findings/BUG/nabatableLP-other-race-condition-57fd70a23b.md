# [BUG] Duplicate externalItemId check can be bypassed by concurrent creates

**File:** [`src/app/api/ops/restaurants/[id]/menu/items/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/menu/items/route.ts#L72-L88) (lines 72, 88)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler checks menuItemExternalIdExistsForRestaurant before calling upsertMenuItem. The underlying RPC uses ON CONFLICT (restaurant_id, external_item_id) DO UPDATE, so concurrent POSTs using the same new externalItemId can both pass the pre-check and the later request updates/replaces the first item's data instead of returning the intended conflict response.

## Recommendation

Make create atomic in the database: use insert-only behavior for this endpoint and translate unique violations to 409, or move the existence check and write into one locked transaction/RPC.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
