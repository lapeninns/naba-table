# Restaurant settings

Active contributors: amanshresthaa

## Purpose

Restaurant settings cover profile, availability, tables, team, menu, Google Business Profile, hours, service periods, turn bands, and templates.

## Directory layout

```text
src/app/app/(app)/settings/restaurant/
src/components/features/restaurant-settings/
server/restaurants/
```

## Key abstractions

| Symbol or file                         | Description      |
| -------------------------------------- | ---------------- |
| `OpsRestaurantSettingsClient`          | Settings shell.  |
| `server/restaurants/details.ts`        | Details.         |
| `server/restaurants/servicePeriods.ts` | Service periods. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Restaurant profile](../systems/restaurant-profile.md), [Menu and drinks](menu-drinks.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                          | Purpose            |
| ------------------------------------------------------------- | ------------------ |
| `src/app/app/(app)/settings/restaurant/profile/page.tsx`      | Profile page.      |
| `src/app/app/(app)/settings/restaurant/availability/page.tsx` | Availability page. |
| `server/restaurants/details.ts`                               | Details domain.    |
| `server/restaurants/servicePeriods.ts`                        | Service periods.   |

Related: [Restaurant profile](../systems/restaurant-profile.md), [Menu and drinks](menu-drinks.md)
