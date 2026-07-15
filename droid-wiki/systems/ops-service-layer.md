# Ops service layer

Active contributors: amanshresthaa, lapeninns

## Purpose

The ops service layer centralizes browser calls from operator pages to guarded `/api/ops/**` route handlers. React Query hooks and contexts use these wrappers for SWR-style UX, placeholder data, and typed mutations.

## Directory layout

```text
src/services/ops/
src/contexts/ops-services.tsx
src/hooks/ops/
src/app/api/ops/
```

## Key abstractions

| Symbol or file                    | Description         |
| --------------------------------- | ------------------- |
| `src/contexts/ops-services.tsx`   | Service provider.   |
| `src/services/ops/bookings.ts`    | Booking wrapper.    |
| `src/services/ops/restaurants.ts` | Restaurant wrapper. |
| `src/services/ops/dual-sync.ts`   | Dual-sync wrapper.  |

## How it works

Ops UI components should call hooks/services instead of hand-rolling fetch logic. Route handlers delegate to `server/ops/**`, `server/restaurants/**`, `server/capacity/**`, or integration modules. React Query SWR UX follows `docs/technical/react-query-swr-ux.md`.

## Integration points

This topic links to [Ops API](../api/ops-api.md), [Ops dashboard and bookings](../features/ops-dashboard-bookings.md), [Restaurant settings](../features/restaurant-settings.md), and [Google Business and dual sync](google-business-dual-sync.md).

## Entry points for modification

## Key source files

| File                                   | Purpose             |
| -------------------------------------- | ------------------- |
| `src/services/ops/bookings.ts`         | Booking service.    |
| `src/services/ops/restaurants.ts`      | Restaurant service. |
| `src/services/ops/dual-sync.ts`        | Dual-sync service.  |
| `docs/technical/react-query-swr-ux.md` | SWR UX contract.    |
