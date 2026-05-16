# [MEDIUM] Google Business Profile operations have no abuse throttling

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/route.ts#L35-L163) (lines 35, 47, 58, 84, 94, 119, 124, 151, 163)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route verifies restaurant-admin membership, but none of the GET, PUT, POST, or DELETE handlers apply consumeRateLimit before expensive or sensitive work. GET/PUT call Google discovery through getGoogleBusinessProfileConnectionState/linkGoogleBusinessProfileLocation, POST performs a Supabase password-confirmation sign-in and then Google sync, and DELETE can revoke Google authorization. An authenticated admin, stolen admin session, or automated client can repeatedly hit these endpoints to burn Google API quota, amplify Supabase Auth password-confirmation attempts, and churn external-profile state without any 429 backoff.

## Recommendation

Add per-user and per-restaurant rate limits around each handler before upstream Google or password-confirmation work, with tighter limits for POST password confirmation and Google sync/discovery. Return 429 with Retry-After and consider caching GET discovery results for a short interval.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
