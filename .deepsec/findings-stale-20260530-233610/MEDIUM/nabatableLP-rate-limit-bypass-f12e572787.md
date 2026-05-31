# [MEDIUM] Unauthenticated schedule endpoint can be cache-busted without rate limiting

**File:** [`src/app/api/restaurants/[slug]/schedule/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/restaurants/[slug]/schedule/route.ts#L34-L59) (lines 34, 40, 41, 50, 55, 59)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public GET handler accepts unauthenticated requests, validates only that date matches YYYY-MM-DD, then performs service-role-backed restaurant and schedule lookups. Although the response is cacheable, an attacker can vary the date parameter across arbitrary valid-looking dates to bypass the 60 second cache and repeatedly force database work through getRestaurantBySlug() and getRestaurantSchedule(). The sibling public calendar-mask endpoint applies requireApiRateLimit and horizon validation, but this schedule endpoint has neither.

## Recommendation

Apply requireApiRateLimit before lookup using the slug as the preflight tenant key, then again after resolving the restaurant using restaurant.id. Also validate the date as a real calendar date and enforce the same booking horizon used by related public availability/calendar endpoints.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
