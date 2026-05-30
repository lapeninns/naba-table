# Restaurant profile

Active contributors: amanshresthaa, lapeninns

## Purpose

Restaurant profile code owns public and ops-facing restaurant data: details, logo, discovery fields, hours, schedule, service periods, turn bands, business context, email templates, visibility, and slug lookup.

## Directory layout

```text
server/restaurants/
src/app/api/restaurants/
src/app/api/ops/restaurants/
src/components/features/restaurant-settings/
```

## Key abstractions

| Symbol or file        | Description              |
| --------------------- | ------------------------ |
| `getRestaurantBySlug` | Public lookup.           |
| `details.ts`          | Profile/details domain.  |
| `schedule.ts`         | Schedule data.           |
| `businessContext.ts`  | Business context domain. |

## How it works

Public routes read slug-based restaurant data for discovery and booking. Ops routes update restaurant-owned settings through guarded `/api/ops/restaurants/**` handlers. Atomic replacements for schedule and business context are backed by recent Supabase migrations.

## Integration points

This topic links to [Restaurant settings](../features/restaurant-settings.md), [Restaurant](../primitives/restaurant.md), [Public API](../api/public-api.md), and [Ops API](../api/ops-api.md).

## Entry points for modification

Start with the file closest to the behavior being changed, then follow imports to the route, hook, or domain module. For route, API, auth, proxy, Supabase, shared UI, or browser changes, follow `docs/sdlc/**` before editing.

## Key source files

| File                                                                             | Purpose                      |
| -------------------------------------------------------------------------------- | ---------------------------- |
| `server/restaurants/index.ts`                                                    | Exports.                     |
| `server/restaurants/details.ts`                                                  | Details.                     |
| `server/restaurants/schedule.ts`                                                 | Schedule.                    |
| `supabase/migrations/20260516082800_atomic_restaurant_schedule_replacements.sql` | Atomic schedule replacement. |
