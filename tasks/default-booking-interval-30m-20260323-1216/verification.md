---
task: default-booking-interval-30m
timestamp_utc: 2026-03-23T12:16:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Automated Verification

- [x] `pnpm exec vitest run tests/reserve/reservation-config.test.ts`
- [x] `pnpm exec eslint reserve/shared/config/reservations.ts lib/env.ts server/restaurants/create.ts server/restaurants/schedule.ts server/ops/table-timeline.ts src/services/ops/restaurants.ts src/components/features/restaurant-settings/RestaurantProfileSection.tsx src/components/features/onboarding/context/OnboardingContext.tsx src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx tests/reserve/reservation-config.test.ts`
- [x] `pnpm run typecheck`

## Outcome

- Default reservation interval is now 30 minutes anywhere the system falls back to a default.
- Existing restaurant-specific interval values are unaffected.
