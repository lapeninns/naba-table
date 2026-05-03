# Restaurant

Active contributors: amanshresthaa

## Purpose

A restaurant is the tenant/business record behind profile, hours, bookings, tables, memberships, menus, and integrations.

## Directory layout

```text
server/restaurants/
src/app/api/restaurants/
src/app/api/ops/restaurants/
```

## Key abstractions

| Symbol or file                                | Description        |
| --------------------------------------------- | ------------------ |
| `server/restaurants/details.ts`               | Details.           |
| `server/restaurants/getActiveRestaurantId.ts` | Active restaurant. |
| `server/restaurants/listRestaurants.ts`       | Listing.           |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Restaurant profile](../systems/restaurant-profile.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                        | Purpose        |
| ------------------------------------------- | -------------- |
| `server/restaurants/index.ts`               | Exports.       |
| `server/restaurants/details.ts`             | Details.       |
| `server/restaurants/getRestaurantBySlug.ts` | Public lookup. |

Related: [Restaurant profile](../systems/restaurant-profile.md)
