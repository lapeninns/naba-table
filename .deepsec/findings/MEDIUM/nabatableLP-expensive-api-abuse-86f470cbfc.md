# [MEDIUM] Connection-state reads refresh tokens and enumerate Google locations

**File:** [`server/google-business-profile/service.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/service.ts#L450-L953) (lines 450, 451, 452, 453, 454, 952, 953)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getGoogleBusinessProfileConnectionState looks like a read helper, but when credentials exist it calls discoverLocationsForProfile. That refreshes the OAuth token and lists Google Business accounts and locations every time state is requested. The related GET routes that call this helper are admin-authenticated but do not add route-level rate limiting or caching, so a compromised or malicious admin session can repeatedly consume Google API quota and churn credential refresh state through a read endpoint.

## Recommendation

Separate cheap connection-state reads from explicit Google discovery/refresh operations. Cache available locations, add consumeRateLimit on route callers, and avoid refreshing tokens on every GET unless the caller explicitly requests a refresh.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
