# [HIGH_BUG] Non-atomic menu and section deletes can partially delete child data

**File:** [`server/menu-hierarchy/repository.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/menu-hierarchy/repository.ts#L404-L691) (lines 404, 421, 435, 453, 604, 605, 607, 619, 682, 683, 685, 691)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

deleteRestaurantMenu() and deleteRestaurantMenuSection() first read item ids, then issue separate delete calls for options/extensions/items, and only afterwards delete the section/menu. These Supabase calls are separate transactions. If another authorized request creates an item in the same menu or section after listMenuItemIds() runs but before the parent delete, the parent delete can fail because restaurant_menu_items has menu/section foreign keys without ON DELETE CASCADE, while the earlier child item deletions have already committed. The result is a failed delete response with the menu or section still present but its previously listed items/options/extensions removed. This is not an auth bypass because the reachable API routes require admin membership and CSRF, but it is a destructive race that can cause menu data loss during concurrent admin/import activity.

## Recommendation

Move destructive hierarchy deletes into a single database transaction, preferably through a Postgres RPC that locks the target menu/section and deletes children and parent atomically. Alternatively add appropriate ON DELETE CASCADE constraints from menu items to menus/sections and delete only the parent row. Avoid read-then-delete-by-cached-id sequences for hierarchical destructive operations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
