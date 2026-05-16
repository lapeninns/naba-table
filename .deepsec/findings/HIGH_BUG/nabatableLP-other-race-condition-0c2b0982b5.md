# [HIGH_BUG] GBP publish jobs are not atomically claimed before side effects

**File:** [`server/google-business-profile/workflow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/workflow.ts#L3007-L3293) (lines 3007, 3041, 3077, 3141, 3253, 3293)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

publishGoogleBusinessProfileWorkflowDraft checks job.status in memory, then updates the draft and job to publishing without a compare-and-set predicate on the previous job status. Two concurrent confirmations for the same preflight job can both pass the preflight_ready check and both run Nabatable and/or Google side effects. The retry path has the same pattern: it validates a retryable status, calls pushDraftToGoogle, then updates the job. A mixed success/failure race can duplicate audit/Google writes or let a rollback/failure update overwrite a successful concurrent publish.

## Recommendation

Atomically claim the job with a conditional update such as status='publishing' WHERE id=? AND status='preflight_ready' RETURNING \*, and abort when no row is returned. Use the same compare-and-set or a database lock/RPC for retryable Google push jobs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
