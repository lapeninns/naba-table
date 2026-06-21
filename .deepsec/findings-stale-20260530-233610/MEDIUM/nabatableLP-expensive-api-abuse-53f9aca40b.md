# [MEDIUM] Unthrottled draft generation can churn Google sync state

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts#L17-L30) (lines 17, 30)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This authenticated POST route has no rate limit and calls createGoogleBusinessProfileWorkflowDraft(), which traces into syncGoogleBusinessProfileBusinessInformation(), archives existing workflow drafts, and inserts a new draft. The file is marked as an orphan route with no client caller, but it remains reachable to any restaurant admin or compromised admin session and can be looped to consume Google Business Profile API quota and churn review draft state.

## Recommendation

Delete the orphan route if it is no longer needed, or add consumeRateLimit() keyed by user and restaurant plus server-side debouncing/idempotency for draft generation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
