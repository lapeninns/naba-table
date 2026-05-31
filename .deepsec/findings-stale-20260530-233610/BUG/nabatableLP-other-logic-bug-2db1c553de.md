# [BUG] Queued publish idempotency can replay a different decision set

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts#L80-L96) (lines 80, 85, 86, 96)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

When queue mode is selected, the route passes the caller-controlled clientRequestId directly as the queue idempotencyKey. The queue helper returns an existing job for the same restaurant/provider/jobKind/idempotencyKey without comparing the queued payload or decision hash. A second queued publish using the same clientRequestId but different decisions receives a 202 response with the old job, while the worker will execute the original payload. This does not bypass auth or tenant checks, but it can make operators believe a new publish was queued when stale or different Google/Core changes will run instead.

## Recommendation

Mirror the non-queued publish idempotency behavior: store or derive a decision hash for queued jobs and return a conflict when an existing idempotency key has a different payload, or include the decision hash in the queue idempotency key.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
