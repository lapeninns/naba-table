# [MEDIUM] Location selection can repeatedly trigger unthrottled Google API work

**File:** [`src/app/api/ops/restaurants/[id]/google-business/locations/select/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/locations/select/route.ts#L40-L41) (lines 40, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

A valid POST calls linkGoogleBusinessProfileLocation and then syncGoogleBusinessProfileBusinessInformation. Tracing those services shows Google token refresh, account/location discovery, profile fetches, attribute fetches, and sync-run writes. The route has no consumeRateLimit guard, so a malicious or compromised restaurant admin can repeatedly call it to burn Google quota and create sync churn.

## Recommendation

Add a per-user/per-restaurant rate limit and idempotency or debounce around location selection and the follow-up sync.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)
