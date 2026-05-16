# [BUG] Previous FoodMenus identities trust unstable Google array paths

**File:** [`server/google-business-profile/food-menus.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus.ts#L1265-L1739) (lines 1265, 1299, 1304, 1671, 1739)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-data-integrity`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The projection records item identity using a Google array path such as menus[0].sections[0].items[0], and import review matching later trusts only that path to recover the local item. If the Google menu is reordered or another item is inserted at the same path, the code can match the wrong local item with previous_identity confidence and build a suggested patch against that wrong item.

## Recommendation

Validate a previous path identity against the expected section label, item name, and price before trusting it. If those checks fail, fall back to display matching or mark the row unmatched with a warning.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
