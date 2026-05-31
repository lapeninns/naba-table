# [HIGH_BUG] FoodMenus preflight passes without alternate baseline validation

**File:** [`server/dual-sync/publish/preflight.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/publish/preflight.ts#L50-L96) (lines 50, 88, 90, 96)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-preflight-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

For location.foodMenus, the preflight strategy records provider validateOnly as unsupported but still returns status passed based only on the presence of a Google update mask. Since FoodMenus writes are full-resource replacements and Google has no validateOnly support, this required preflight should enforce the alternate baseline/projection-hash guard before allowing execution. As written, a required preflight group can proceed without proving the full menu resource still matches the reviewed state.

## Recommendation

Fail closed for location.foodMenus unless resource-level expected hashes have been supplied and verified, or extend the preflight context/port to run the FoodMenus baseline/projection validation before returning passed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
