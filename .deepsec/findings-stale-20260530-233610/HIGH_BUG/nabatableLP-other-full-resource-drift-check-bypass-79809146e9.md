# [HIGH_BUG] Full-resource FoodMenus exports can omit whole-snapshot drift pins

**File:** [`server/dual-sync/publish/planner.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/publish/planner.ts#L83-L260) (lines 83, 89, 255, 260)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-full-resource-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The planner only checks whole Core/GBP snapshot hashes when optional pinnedCoreSnapshotHash or pinnedGbpSnapshotHash values are present. That is not enough for FoodMenus: selecting one foodMenus item later publishes the current full Google menus resource, so field-level pins cover only the selected item while unselected menu changes can still be pushed. A direct authenticated publish or queued/manual path can omit the snapshot pins, pass planner validation for one unchanged item, and overwrite Google with unreviewed current menu state.

## Recommendation

Require whole-snapshot or resource-level pins for destructive/full-resource write groups, especially googleUpdateMask menus / writeGroup location.foodMenus. Reject missing pins before grouping, and pass expected FoodMenus baseline/projection hashes to the publish port or publish from the frozen snapshot used by the planner.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
