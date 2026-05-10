# Booking

Active contributors: amanshresthaa

## Purpose

A booking is the reservation lifecycle record used by public booking, guest account pages, ops dashboards, capacity, history, email, and SMS.

## Directory layout

```text
server/bookings.ts
server/bookings/
server/ops/booking-lifecycle/
```

## Key abstractions

| Symbol or file            | Description              |
| ------------------------- | ------------------------ |
| `server/bookings.ts`      | Booking orchestration.   |
| `server/booking/types.ts` | Types.                   |
| `stateMachine.ts`         | Lifecycle state machine. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Booking domain](../systems/booking-domain.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                           | Purpose        |
| ---------------------------------------------- | -------------- |
| `server/bookings.ts`                           | Domain.        |
| `server/booking/types.ts`                      | Types.         |
| `server/ops/booking-lifecycle/stateMachine.ts` | State machine. |

Related: [Booking domain](../systems/booking-domain.md)
