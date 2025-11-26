# Cache Strategy — React Query (Sprint 1)

## Principles

- Stale long-lived data to reduce re-fetching; keep volatile data fresh.
- Cache GC >= 2× staleTime for fast back/forward navigation.
- Prefer targeted invalidations after mutations over low staleTime.

## Stale Time Table (ms)

| Data type                         | Keys                                                 | staleTime     | Notes                                              |
| --------------------------------- | ---------------------------------------------------- | ------------- | -------------------------------------------------- |
| Profile/self                      | `['profile']`                                        | 300000 (5m)   | Rarely changes                                     |
| Restaurant details                | `['owner','restaurants',id,'details']`               | 300000–600000 |                                                    |
| Operating hours / service periods | `['ops','restaurants',id,'hours'/'service-periods']` | 300000 (5m)   |                                                    |
| Strategic settings                | `['ops','settings','strategic-config',id]`           | 300000 (5m)   |                                                    |
| Tables / zones                    | `['ops','tables',id,...]`                            | 120000–180000 | Inventory changes occasionally                     |
| Occasions catalog                 | `['ops','occasions','list']`                         | 300000 (5m)   |                                                    |
| Customers list                    | `['ops','customers','list']`                         | 120000 (2m)   |                                                    |
| Bookings (ops & guest)            | `['ops','bookings',...]`, `['bookings',...]`         | 45000–60000   | High churn; relies on invalidation after mutations |
| Dashboard summary/heatmap         | `['ops','dashboard',...]`                            | 60000         |                                                    |
| Reservation detail                | `['reservation', id]`                                | 60000         |                                                    |
| Schedule/availability             | `['reservations','schedule',slug,date]`              | 60000         | Volatile; refetch on focus                         |
| Restaurant list                   | `['restaurants','list']`                             | 120000        |                                                    |

## GC Time

- Calculated automatically as `max(staleTime * 2, 5m)` in `lib/query/staleTimes.ts`.

## Defaults

- Base staleTime remains 30s for uncategorized keys.
- refetchOnWindowFocus disabled globally; per-query enable if volatility demands.

## Mutation Guidance (link)

- See `docs/mutation-pattern.md` for optimistic pattern and invalidation checklist.
