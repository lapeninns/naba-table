# [BUG] FoodMenus fields are omitted from orchestrator snapshot value lookup

**File:** [`server/dual-sync/publish/orchestrator.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/orchestrator.ts#L59-L80) (lines 59, 78, 80)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

DualSyncSectionKey includes foodMenus and the default ports support foodMenus publishing, but readSectionValue in the orchestrator has no foodMenus case and falls through to null. For foodMenus decisions, beforeCoreHash and beforeGbpHash are therefore computed from null instead of snapshot.foodMenus, causing legitimate pinned FoodMenus publishes to fail drift checks or to run with disabled pins when null is submitted.

## Recommendation

Add a foodMenus case returning snapshot.foodMenus ?? { items: [] } and cover single and batch FoodMenus publish decisions with pinned-hash tests.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

**Verdict:** fixed

`server/dual-sync/publish/orchestrator.ts` now returns `snapshot.foodMenus ?? { items: [] }` for `sectionKey: 'foodMenus'`, so FoodMenus pinned-hash checks are computed from real snapshot data instead of `null`. The FoodMenus publish-route and publish-preview tests cover FoodMenus field decisions reaching the publish/planning path, and the recompute test covers FoodMenus item state hashing through the dynamic registry.
