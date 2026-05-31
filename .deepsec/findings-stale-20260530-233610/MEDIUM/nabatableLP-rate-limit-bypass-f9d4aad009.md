# [MEDIUM] Invalid guest lookup tokens bypass rate limiting while still writing observability events

**File:** [`server/bookings/guest-lookup-response.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings/guest-lookup-response.ts#L74-L165) (lines 74, 107, 113, 122, 165)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildGuestLookupHttpResponse extracts a session recovery token from headers, query string, or cookie, validates it, records a guest_lookup.access_token_rejected observability event for invalid tokens, and returns 401 before the rate limiter is reached. The rate limiter is only called later after a valid token or contact-query restaurant has been resolved. An unauthenticated attacker can repeatedly call the public bookings lookup endpoint with malformed or bad-signature access_token values to trigger token parsing/HMAC work and service-role observability writes without consuming the intended per-IP quota, causing DB/log write amplification.

## Recommendation

Apply an IP-scoped rate limit before token validation and before recording invalid-token observability events, or add a separate low-limit bucket for invalid/missing-secret token attempts. Consider sampling or coalescing rejected-token events.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
