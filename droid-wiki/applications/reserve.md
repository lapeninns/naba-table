# Reserve

Active contributors: amanshresthaa

## Purpose

Reserve is the standalone Vite reservation app. It uses React Router, its own wizard UI, and shared booking adapters/configuration to create reservations through platform APIs.

## Directory layout

```text
reserve/
|-- main.tsx
|-- app/routes.tsx
|-- pages/
|-- features/reservations/wizard/
`-- vite.config.ts
```

## Key abstractions

| Symbol or file           | Description                |
| ------------------------ | -------------------------- |
| `reserve/app/routes.tsx` | Reserve route tree.        |
| `ReservationWizard`      | Wizard UI.                 |
| `useCreateReservation`   | Reservation mutation hook. |
| `reserve/vite.config.ts` | Standalone build config.   |

## How it works

The Vite app keeps its own UI shell while sharing reservation concepts, validation, and API contracts with public booking. Build verification is `pnpm run reserve:build`; browser coverage uses `playwright.reserve.config.ts`.

## Integration points

This topic links to [Public booking](../features/public-booking.md), [Booking domain](../systems/booking-domain.md), and public booking/availability APIs.

## Entry points for modification

Start with the file closest to the behavior being changed, then follow imports to the route, hook, or domain module. For route, API, auth, proxy, Supabase, shared UI, or browser changes, follow `docs/sdlc/**` before editing.

## Key source files

| File                                                         | Purpose              |
| ------------------------------------------------------------ | -------------------- |
| `reserve/main.tsx`                                           | Vite entry.          |
| `reserve/app/routes.tsx`                                     | Routes.              |
| `reserve/features/reservations/wizard/ReservationWizard.tsx` | Wizard UI.           |
| `tests/reserve/buildReservationDraft.test.ts`                | Representative test. |
