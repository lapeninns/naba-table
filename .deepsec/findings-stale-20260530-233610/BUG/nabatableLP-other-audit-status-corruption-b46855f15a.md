# [BUG] Preflight-failed operation groups are later classified as skipped

**File:** [`server/dual-sync/publish/orchestrator-domain.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/publish/orchestrator-domain.ts#L120-L123) (lines 120, 123)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-audit-status-corruption`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

operationGroupStatusForOperations returns skipped whenever an operation group has zero operation rows. In the publish flow, a required export preflight failure marks the operation group failed and prevents operation rows from being created for that group. Finalization then recomputes the group status from the empty operation list and uses this helper, which downgrades that failed preflight group to skipped and clears failure context. This corrupts durable audit state for high-risk/destructive export groups and can make a Google validation/preflight failure appear as a non-event in job detail views.

## Recommendation

Do not derive final group status from operation rows alone when the group already has a failed preflight state. Preserve terminal failed preflight statuses in finalization, or pass the current group/preflight status into the status derivation helper so an empty operation list is only skipped for groups that were intentionally skipped.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
