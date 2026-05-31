# [BUG] Duplicate externalDrinkId check can be bypassed by concurrent creates

**File:** [`src/app/api/ops/restaurants/[id]/drinks/items/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/drinks/items/route.ts#L72-L88) (lines 72, 88)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler first checks drinkItemExternalIdExistsForRestaurant and later calls upsertDrinkItem. The underlying database RPC uses ON CONFLICT (restaurant_id, external_drink_id) DO UPDATE, so two concurrent POSTs with the same new externalDrinkId can both pass the pre-check; the later RPC updates the item and replaces modifier data instead of returning the intended 409 conflict. This can corrupt same-restaurant drink menu data under concurrent admin actions or retries.

## Recommendation

Move the create-vs-conflict decision into a single database transaction/RPC. For this create endpoint, use insert-only semantics and map unique-constraint violations to 409, or explicitly require an item-specific update route for updates.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
