# [HIGH_BUG] Dual-sync jobs can remain permanently stuck in running state

**File:** [`src/app/api/cron/dual-sync/queue/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/cron/dual-sync/queue/route.ts#L63-L66) (lines 63, 65, 66)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-stale-queue-claim`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The cron route drains jobs through processNextDualSyncJob, which claims a row by marking it running before executing the job. If the serverless invocation or process dies after the claim but before completeDualSyncJob or failDualSyncJob runs, future cron ticks will not recover it: the queue claim helper only selects queued/retrying jobs and there is no stale running lease timeout. A stuck idempotent job can therefore block that sync action indefinitely.

## Recommendation

Add lease expiry/reclaim logic for running dual_sync_jobs, preferably in an atomic database RPC: mark running jobs with locked_at older than a timeout back to retrying, increment attempts safely, and claim the next job in one transaction.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
