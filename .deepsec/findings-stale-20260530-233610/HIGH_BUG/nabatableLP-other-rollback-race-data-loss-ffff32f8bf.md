# [HIGH_BUG] Rollback can overwrite concurrent restaurant edits

**File:** [`server/google-business-profile/workflowPublishExecution.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowPublishExecution.ts#L213-L246) (lines 213, 215, 223, 225, 233, 235, 243, 246)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-rollback-race-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

restoreCoreSnapshotAfterFailedPublish restores whole selected sections from a snapshot captured before publishing. It calls updateRestaurantDetails, updateOperatingHours, updateServicePeriods, and updateRestaurantBusinessContext without checking updated_at, hashes, or a restaurant-level lock. If a publish partially fails while another admin or automation changes the same restaurant section, the rollback can blindly replace those newer changes with the old pre-publish snapshot, causing data loss.

## Recommendation

Serialize publish and rollback with a per-restaurant advisory lock or durable workflow lock. Add optimistic version/hash predicates before rollback writes, and if current state no longer matches the expected post-failure state, stop and mark the workflow as conflict/manual-repair instead of restoring over newer data.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
