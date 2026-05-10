# [BUG] Restaurant demand profile lookup ignores time windows and priority

**File:** [`server/capacity/demand-profiles.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/demand-profiles.ts#L316-L489) (lines 316, 323, 346, 352, 489)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The fallback demand-profile path filters rules by service window, day, and minute, then sorts by priority and duration. The database path selects the first row matching restaurant_id, day_of_week, and service_window with limit(1), but it does not constrain start_minute/end_minute or order by priority. If a restaurant defines multiple demand profiles for the same day and service window, the allocator can apply an arbitrary multiplier for the entire service period.

## Recommendation

Apply the same semantics to database-backed rules as fallback rules: filter rows to the current minute window, order by priority and specificity, and add tests with multiple profiles for the same day/service window.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-02)
