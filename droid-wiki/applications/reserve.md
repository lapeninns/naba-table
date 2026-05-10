# Reserve

Active contributors: amanshresthaa

## Purpose

Reserve is the standalone Vite reservation app with its own routes, wizard UI, and tests. It shares booking concepts with public Next booking flows.

## Directory layout

```text
reserve/
├── main.tsx
├── app/routes.tsx
├── pages/
└── features/reservations/wizard/
```

## Key abstractions

| Symbol or file           | Description             |
| ------------------------ | ----------------------- |
| `reserve/app/routes.tsx` | Reserve route tree.     |
| `ReservationWizard`      | Wizard UI.              |
| `useCreateReservation`   | Guest booking mutation. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Public booking](../features/public-booking.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                          | Purpose               |
| --------------------------------------------- | --------------------- |
| `reserve/main.tsx`                            | Vite entry.           |
| `reserve/app/routes.tsx`                      | Routes.               |
| `reserve/vite.config.ts`                      | Build config.         |
| `tests/reserve/buildReservationDraft.test.ts` | Representative tests. |

Related: [Public booking](../features/public-booking.md)
