# [MEDIUM] Unthrottled GET performs live Google discovery and token refresh

**File:** [`src/app/api/ops/restaurants/[id]/google-business/locations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/locations/route.ts#L13-L20) (lines 13, 20)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The GET handler performs backend admin authorization, but then calls getGoogleBusinessProfileConnectionState. Tracing that helper shows it can refresh the stored Google OAuth credential, update credential metadata, and list Google Business accounts and locations via upstream Google APIs. There is no consumeRateLimit guard or cache boundary in this route. Because the expensive, side-effecting work is exposed as GET, a logged-in admin can be navigated to this URL or can loop it to consume Google quota and churn token refresh state without an intentional mutation request.

## Recommendation

Make this GET return cached DB state only, or move live Google discovery/token refresh behind a POST protected by validateCsrfToken and a per-user/per-restaurant rate limit.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)
