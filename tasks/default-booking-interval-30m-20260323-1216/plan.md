---
task: default-booking-interval-30m
timestamp_utc: 2026-03-23T12:16:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Change default booking interval to 30 minutes

## Objective

We will make 30 minutes the default reservation interval anywhere the system falls back to a default because no restaurant-specific interval has been configured.

## Success Criteria

- [ ] Shared reservation config defaults to 30 minutes.
- [ ] Server schedule/create fallbacks default to 30 minutes.
- [ ] New restaurant and onboarding form defaults default to 30 minutes.
- [ ] Regression coverage exists for the shared default.

## Architecture & Components

- `reserve/shared/config/reservations.ts`
- `lib/env.ts`
- `server/restaurants/create.ts`
- `server/restaurants/schedule.ts`
- `server/ops/table-timeline.ts`
- `src/services/ops/restaurants.ts`
- `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`
- `src/components/features/onboarding/context/OnboardingContext.tsx`
- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx`

## Testing Strategy

- Add a focused unit test for the shared reservation default.
- Run lint, typecheck, and focused tests.
