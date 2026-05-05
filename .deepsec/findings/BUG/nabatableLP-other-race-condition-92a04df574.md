# [BUG] Publish job transition can be raced, causing duplicate publishes

**File:** [`server/google-business-profile/workflow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/workflow.ts#L3007-L3141) (lines 3007, 3031, 3041, 3077, 3141)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

publishGoogleBusinessProfileWorkflowDraft checks job.status in memory, then updates the draft and publish job to publishing without a compare-and-set condition on the previous job status. Two concurrent publish confirmations for the same preflight job can both pass the preflight_ready check and both execute the Nabatable and/or Google publish side effects. The final draft/job status then depends on the last writer, and audit events or Google pushes can be duplicated.

## Recommendation

Claim the job with an atomic UPDATE ... WHERE id = ? AND status = 'preflight_ready' RETURNING \* before any side effects, or use a transactional/advisory lock around the publish state machine.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
