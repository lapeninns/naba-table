# [HIGH_BUG] Projection snapshot deduplication can corrupt historical identity mappings

**File:** [`server/google-business-profile/food-menus-storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/food-menus-storage.ts#L301-L446) (lines 301, 303, 373, 376, 431, 446)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-integrity`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

FoodMenus projection snapshots are deduplicated only by snapshot_hash. When an insert conflicts, recordFoodMenusSnapshot returns the existing snapshot, and recordFoodMenusProjection then writes the current projection identities into that existing snapshot. The identity map is not part of the hash, and saveProjectedFoodMenusIdentities upserts current rows without replacing/removing the old identity set. If a later projection produces the same Google FoodMenus payload but with different local item IDs or stable keys, the old snapshot's identity rows can be overwritten or augmented. Downstream import matching uses these previous identities to map Google paths back to local menu items, so stale or duplicate identities can cause Google import decisions to apply to the wrong local menu item.

## Recommendation

Make projection snapshots immutable: either include a canonical identity-map hash in the snapshot uniqueness key, or always create a new projection snapshot when identities change. Persist the snapshot and a full replacement of its identities atomically, preferably through a database RPC/transaction that deletes stale identity rows for the snapshot before inserting the new set.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
