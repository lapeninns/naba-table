# [MEDIUM] Manual sync is unthrottled despite upstream API and DB side effects

**File:** [`src/app/api/ops/restaurants/[id]/google-business/sync/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/sync/route.ts#L23) (lines 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route calls syncGoogleBusinessProfileBusinessInformation without any consumeRateLimit guard. That service refreshes Google credentials, fetches Google profile and attributes, updates external profile state, and records sync runs. A malicious or compromised admin can repeatedly invoke this endpoint to consume Google quota and create repeated sync writes.

## Recommendation

Add a per-user/per-restaurant rate limit, cooldown, or job de-duplication around manual sync attempts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)
