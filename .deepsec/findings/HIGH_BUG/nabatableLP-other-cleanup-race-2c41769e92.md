# [HIGH_BUG] Failed clone can delete a restaurant it did not create

**File:** [`scripts/clone-restaurant-config.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/clone-restaurant-config.ts#L187-L653) (lines 187, 198, 638, 640, 653)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-cleanup-race`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script checks that the target slug is absent before entering the try block, then the catch handler always calls cleanupTargetBySlug(targetRestaurant.slug). If another process creates the target restaurant after ensureTargetAbsent() but before insertRestaurant() fails, the catch cleanup will look up that slug and delete the other restaurant and its related config rows. Cleanup is keyed only by slug, not by an ID proven to have been inserted by this script.

## Recommendation

Track the restaurant ID returned by insertRestaurant() and run cleanup only when that ID exists. Delete by that inserted ID, not by slug. Prefer wrapping the clone in a transaction or using an advisory lock/unique insert flow that cannot clean up resources created by another actor.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)
