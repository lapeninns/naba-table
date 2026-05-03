# Restaurant profile

Active contributors: amanshresthaa

## Purpose

Restaurant profile code owns profile, hours, schedule, service periods, turn bands, public visibility, logos, business context, and templates.

## Directory layout

```text
server/restaurants/
src/app/api/restaurants/
src/app/api/ops/restaurants/
```

## Key abstractions

| Symbol or file        | Description       |
| --------------------- | ----------------- |
| `getRestaurantBySlug` | Public lookup.    |
| `schedule.ts`         | Schedule data.    |
| `turnBands.ts`        | Turn-band policy. |
| `emailTemplates.ts`   | Template logic.   |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Restaurant settings](../features/restaurant-settings.md), [Restaurant](../primitives/restaurant.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                   | Purpose   |
| -------------------------------------- | --------- |
| `server/restaurants/index.ts`          | Exports.  |
| `server/restaurants/schedule.ts`       | Schedule. |
| `server/restaurants/operatingHours.ts` | Hours.    |
| `server/restaurants/details.ts`        | Details.  |

Related: [Restaurant settings](../features/restaurant-settings.md), [Restaurant](../primitives/restaurant.md)
