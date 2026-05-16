# [BUG] Food menu fields are advertised as publishable but the publish path rejects them

**File:** [`server/dual-sync/registry/food-menus.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/registry/food-menus.ts#L115-L130) (lines 115, 123, 130)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The food menu registry emits fields with sectionKey "foodMenus" and exportable: true, with googleUpdateMask "menus". Tracing the consumer path shows these fields are included in the dual-sync UI, but the POST /api/ops/restaurants/[id]/dual-sync/publish schema omits "foodMenus" from its allowed sectionKey enum, so normal export decisions generated from these registry entries are rejected before the food menu export port can run. The orchestrator's readSectionValue also omits the foodMenus case, which would make per-field drift checks operate on null if the route schema were relaxed. This is not a security vulnerability, but it makes the advertised FoodMenus dual-sync export workflow fail.

## Recommendation

Either add full foodMenus support to the publish request schema and orchestrator readSectionValue, or mark FoodMenus registry entries non-exportable until that path is wired end to end.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
