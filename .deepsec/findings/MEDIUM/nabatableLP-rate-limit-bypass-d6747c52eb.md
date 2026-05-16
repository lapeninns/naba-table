# [MEDIUM] GBP preflight can be repeated without rate limiting

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts#L62-L94) (lines 62, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After the admin check, the route directly invokes preflightGoogleBusinessProfileWorkflowDraft with attacker-controlled selections and no consumeRateLimit call. The traced workflow refreshes Google Business Profile business information during preflight before the idempotent publish job is reused, so a valid admin session can repeatedly consume Google API quota and database work for a restaurant/draft.

## Recommendation

Add a server-side rate limit keyed by user id, restaurant id, draft id, and IP before invoking the preflight workflow, and avoid repeating external refresh work when an equivalent preflight job already exists.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
