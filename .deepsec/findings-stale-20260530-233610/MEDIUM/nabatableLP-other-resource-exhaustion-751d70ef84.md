# [MEDIUM] Unbounded zone batch creates unlimited concurrent service-role writes

**File:** [`src/app/api/onboarding/restaurant/[id]/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/onboarding/restaurant/[id]/zones/route.ts#L19-L51) (lines 19, 20, 50, 51)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route uses backend restaurant authorization and CSRF, but zones is an unbounded array and zone names/sort orders have no practical limits. The handler maps the full array into Promise.all createZone calls using the service-role client. An authenticated restaurant owner/manager can submit a large payload that generates many concurrent database writes and persistent zone rows, with no per-user or per-tenant rate limit.

## Recommendation

Add rate limiting, cap the number of zones per request/restaurant, cap name length and sortOrder range, and avoid unbounded Promise.all write fan-out.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
