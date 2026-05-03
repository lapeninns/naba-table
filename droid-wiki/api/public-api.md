# Public API

Active contributors: amanshresthaa

## Purpose

Public APIs support restaurant discovery, availability, bookings, confirmations, guest booking details, and profile data.

## Directory layout

```text
src/app/api/bookings/
src/app/api/restaurants/
src/app/api/availability/
src/app/api/reservations/
```

## Key abstractions

| Symbol or file                                     | Description                 |
| -------------------------------------------------- | --------------------------- |
| `src/app/api/bookings/route.ts`                    | Public booking create/list. |
| `src/app/api/restaurants/[slug]/schedule/route.ts` | Schedule.                   |
| `src/app/api/availability/route.ts`                | Availability.               |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Public booking](../features/public-booking.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                    | Purpose            |
| ------------------------------------------------------- | ------------------ |
| `src/app/api/bookings/route.ts`                         | Bookings.          |
| `src/app/api/restaurants/[slug]/route.ts`               | Restaurant detail. |
| `src/app/api/restaurants/[slug]/calendar-mask/route.ts` | Calendar mask.     |

Related: [Public booking](../features/public-booking.md)
