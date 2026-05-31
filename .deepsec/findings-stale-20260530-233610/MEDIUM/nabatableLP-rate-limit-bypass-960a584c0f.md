# [MEDIUM] Unauthenticated public schedule lookups are unbounded and unrated

**File:** [`server/restaurants/schedule.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/restaurants/schedule.ts#L99-L585) (lines 99, 490, 513, 517, 585)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `230744634+lapeninns@users.noreply.github.com` _(via last-committer)_

## Finding

getRestaurantSchedule accepts any date matching only YYYY-MM-DD shape, defaults to the service-role Supabase client, then performs multiple database reads plus an occasion catalog lookup. The shipped public route src/app/api/restaurants/[slug]/schedule/route.ts resolves any active restaurant slug and calls this helper without requireApiRateLimit, real-date validation, or a booking-horizon limit; src/proxy.ts explicitly exempts this schedule route from ops API guarding. An unauthenticated attacker can vary arbitrary/far-future date values to bypass the 60 second cache key, repeatedly force service-role database work, and scrape scheduling/closure behavior over an unbounded calendar. Calendar-mask and availability routes contain rate limits and horizon checks, but this schedule path does not have equivalent mitigation.

## Recommendation

Add public and tenant-scoped requireApiRateLimit checks to the schedule route before calling getRestaurantSchedule, validate dates with safeDate or equivalent real-date parsing, and enforce the same booking horizon used by calendar-mask/booking flows. Consider also making getRestaurantSchedule reject invalid or out-of-policy dates so future public callers cannot bypass the route-level guard.

## Recent committers (`git log`)

- lapeninns <230744634+lapeninns@users.noreply.github.com> (2026-05-15)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-17)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
