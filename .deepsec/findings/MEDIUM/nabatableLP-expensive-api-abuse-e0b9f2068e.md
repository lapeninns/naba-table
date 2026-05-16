# [MEDIUM] Queue feed loads global service-role job history before tenant filtering

**File:** [`src/app/api/ops/email-queue/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/email-queue/route.ts#L203-L206) (lines 203, 204, 205, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After authenticating a restaurant member, the handler calls getEmailQueueStatus(true, { jobLimit: 'all' }) and only then filters jobs by restaurantId in application code. The queue helper uses the service-role client and can load thousands of rows per status across all restaurants, regardless of the requested pageSize. Any authenticated member can repeatedly force global queue scans, sorting, and counts for data they are not requesting.

## Recommendation

Push restaurantId, status, pagination, and limits into the queue query itself, using the restaurant/status index. Add caching or rate limiting for this ops feed if large queue histories are expected.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-24)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
