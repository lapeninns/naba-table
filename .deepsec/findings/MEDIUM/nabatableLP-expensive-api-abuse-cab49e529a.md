# [MEDIUM] Preflight can repeatedly trigger Google Business Profile sync without rate limiting

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts#L62-L94) (lines 62, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route has no consumeRateLimit guard before calling preflightGoogleBusinessProfileWorkflowDraft. The preflight path calls buildPublishPreflightContext, which calls detectProviderStaleItems and then syncGoogleBusinessProfileBusinessInformation, causing Google Business Profile API reads and local sync writes before the publish-job idempotency check. An authenticated admin or compromised session can repeatedly hit this orphan but reachable route to burn Google quota and database work.

## Recommendation

Add per-user and per-restaurant rate limiting before invoking preflight. Consider checking for an existing idempotent preflight job before refreshing Google state, or cache/throttle provider stale checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
