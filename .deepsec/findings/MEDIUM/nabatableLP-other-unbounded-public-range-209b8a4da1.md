# [MEDIUM] Public calendar mask accepts unbounded date ranges

**File:** [`src/app/api/restaurants/[slug]/calendar-mask/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/restaurants/[slug]/calendar-mask/route.ts#L8-L73) (lines 8, 14, 51, 59, 69, 73)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-unbounded-public-range`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public, unauthenticated calendar-mask endpoint validates only YYYY-MM-DD shape and ordering before passing from/to into getRestaurantCalendarMask. That helper performs range queries over restaurant_operating_hours and returns every matching closure/override date. An attacker can request very large ranges, forcing unbounded DB scans and large responses and scraping all recorded override dates for a restaurant.

## Recommendation

Enforce a maximum range appropriate for the booking UI, for example one or two months, reject dates outside the supported booking window, and add public endpoint rate limiting.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-13)

**Verdict:** fixed

The public calendar-mask route now caps requested ranges at 62 days, rejects requests beyond the booking horizon, and applies public/tenant rate limits before returning mask data. Oversized ranges are rejected before restaurant lookup or mask queries.

Validation: `pnpm exec vitest run tests/server/calendar-mask-route.test.ts tests/server/resend-webhook-route.test.ts`
