# [MEDIUM] Attacker-controlled slug bypasses the pre-lookup rate limit

**File:** [`src/app/api/restaurants/[slug]/calendar-mask/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/restaurants/[slug]/calendar-mask/route.ts#L77-L94) (lines 77, 80, 89, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The public calendar-mask route applies its preflight rate limit with `tenantId: slug` before resolving the restaurant. Because `slug` is entirely attacker-controlled, an unauthenticated client can use a fresh random slug on every request, creating a fresh rate-limit bucket while still reaching the service-role `getRestaurantBySlug(slug)` database lookup. The tenant-level limiter only runs after a valid restaurant is found, so random/nonexistent slugs can generate unbounded lookup load and 404 responses without hitting the intended per-client preflight limit.

## Recommendation

Add a global/IP-only preflight limiter before any slug-keyed limiter or database lookup. Validate the slug against the existing restaurant slug shape and a sane max length before lookup, then keep the post-resolution tenant limiter keyed by `restaurant.id`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-13)
