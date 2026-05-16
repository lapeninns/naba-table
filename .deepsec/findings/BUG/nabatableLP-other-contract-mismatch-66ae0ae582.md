# [BUG] FoodMenus dual-sync rows are selectable but rejected by the publish API

**File:** [`src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx#L55-L276) (lines 55, 66, 263, 264, 276)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-contract-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The shell includes foodMenus in its section list and serializes selected field.sectionKey into the publish payload. The traced publish route schema does not allow the foodMenus section, so any FoodMenus field selected from the dual-sync field rows is submitted and then rejected with a 422 instead of being published.

## Recommendation

Either add foodMenus to the publish route schema and server validation, or hide/disable FoodMenus field-row publish actions and rely only on the dedicated import review panel.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

The publish and preview route schemas now use the shared `DUAL_SYNC_SECTION_KEYS` registry, which includes `foodMenus`. `server/dual-sync/publish/orchestrator.ts` also reads `snapshot.foodMenus ?? { items: [] }` for field hash checks. `tests/server/dual-sync-publish-route.test.ts` and `tests/server/dual-sync-publish-preview-route.test.ts` cover FoodMenus decisions being accepted and forwarded to the publish path instead of rejected with 422.
