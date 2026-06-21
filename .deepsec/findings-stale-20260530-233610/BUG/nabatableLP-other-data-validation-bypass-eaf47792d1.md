# [BUG] Import review patches can bypass canonical numeric validation

**File:** [`server/google-business-profile/food-menus-import-decision-domain.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/food-menus-import-decision-domain.ts#L41-L171) (lines 41, 79, 113, 117, 144, 171)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-data-validation-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

parseSuggestedPatch accepts any finite basePrice and nutrition/serving numeric values, plus arbitrary integer modifier min/max values, without enforcing the nonnegative and integer constraints used by the normal canonical menu schemas. isCreateSuggestedPatch only rejects negative basePrice for create_new_item, so apply_to_nabatable can still apply a crafted or malformed import-review patch that persists impossible negative prices, nutrition amounts, or serving counts through the canonical patch path.

## Recommendation

Validate suggested patches with the same constraints as the canonical menu input/patch schemas before planning or applying a decision. At minimum reject negative basePrice and nutrition values, require servesNum to be a nonnegative integer, require minSelect/maxSelect to be nonnegative with maxSelect >= minSelect, and re-parse the final canonical patch/input before repository writes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
