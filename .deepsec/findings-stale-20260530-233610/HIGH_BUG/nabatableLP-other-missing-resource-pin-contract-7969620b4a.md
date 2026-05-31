# [HIGH_BUG] Publish input contract makes snapshot pins optional for destructive writes

**File:** [`server/dual-sync/publish/types.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/publish/types.ts#L37-L97) (lines 37, 45, 48, 95, 97)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-missing-resource-pin-contract`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

DualSyncRunPublishInput makes pinnedCoreSnapshotHash and pinnedGbpSnapshotHash optional, while DualSyncPublishGroup explicitly represents preflight/manual-confirmation/destructive-write groups. The type contract has no required resource-level pin or acknowledgement for full-resource exports such as FoodMenus, so callers can construct syntactically valid publish requests that cannot safely prove the reviewed full resource is still current.

## Recommendation

Strengthen the publish contract so destructive/full-resource groups require whole-snapshot or resource-specific expected hashes, and add server-enforced confirmation/preflight artifacts rather than relying on optional caller-provided fields.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
