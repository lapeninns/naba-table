# Ops service layer

Active contributors: amanshresthaa

## Purpose

The ops service layer centralizes browser calls from operator pages to `/api/ops/**` route handlers. Hooks and contexts use these wrappers for React Query flows.

## Directory layout

```text
src/services/ops/
src/contexts/ops-services.tsx
src/hooks/ops/
```

## Key abstractions

| Symbol or file                    | Description         |
| --------------------------------- | ------------------- |
| `src/contexts/ops-services.tsx`   | Service provider.   |
| `src/services/ops/bookings.ts`    | Booking wrapper.    |
| `src/services/ops/restaurants.ts` | Restaurant wrapper. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Ops API](../api/ops-api.md), [Ops dashboard and bookings](../features/ops-dashboard-bookings.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                              | Purpose             |
| --------------------------------- | ------------------- |
| `src/services/ops/bookings.ts`    | Booking service.    |
| `src/services/ops/restaurants.ts` | Restaurant service. |
| `src/services/ops/dual-sync.ts`   | Dual-sync service.  |
| `lib/http/fetchJson.ts`           | Fetch helper.       |

Related: [Ops API](../api/ops-api.md), [Ops dashboard and bookings](../features/ops-dashboard-bookings.md)
