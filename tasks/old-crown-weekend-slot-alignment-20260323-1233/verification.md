---
task: old-crown-weekend-slot-alignment
timestamp_utc: 2026-03-23T12:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA

- Not applicable; no UI code changed in this task.

## Remote Data Verification

- [x] Old Crown interval updated to `30`.
- [x] Built-in `lunch` and `dinner` occasion availability cleared.
- [x] Friday slots verified.
- [x] Saturday slots verified.
- [x] Sunday slots verified.

### Verified schedule output

- Friday `2026-03-27`
  - Interval: `30`
  - Lunch slots remain constrained by the Friday `12:00-15:00` service period.
  - Observed enabled slots:
    - Lunch: `12:00`, `12:30`, `13:00`, `13:30`, `14:00`, `14:30`
    - Dinner: `17:00`, `17:30`, `18:00`, `18:30`, `19:00`, `19:30`, `20:00`, `20:30`, `21:00`, `21:30`
- Saturday `2026-03-28`
  - Interval: `30`
  - Observed enabled slots:
    - Lunch: `12:00`, `12:30`, `13:00`, `13:30`, `14:00`, `14:30`, `15:00`, `15:30`, `16:00`, `16:30`
    - Dinner: `17:00`, `17:30`, `18:00`, `18:30`, `19:00`, `19:30`, `20:00`, `20:30`, `21:00`, `21:30`
- Sunday `2026-03-29`
  - Interval: `30`
  - Observed enabled slots:
    - Lunch: `12:00`, `12:30`, `13:00`, `13:30`, `14:00`, `14:30`, `15:00`, `15:30`, `16:00`, `16:30`
    - Dinner: `17:00`, `17:30`, `18:00`, `18:30`, `19:00`, `19:30`, `20:00`, `20:30`

## Code Verification

- `pnpm exec vitest run tests/server/bookings/timeValidation.test.ts tests/reserve/service-slots.test.ts tests/reserve/buildReservationDraft.test.ts tests/reserve/reservation-config.test.ts tests/reserve/occasion-availability.test.ts`
- `pnpm exec eslint server/restaurants/schedule.ts server/bookings/timeValidation.ts server/booking/BookingValidationService.ts src/app/api/bookings/route.ts 'src/app/api/bookings/[id]/route.ts' src/app/api/ops/bookings/route.ts reserve/shared/schedule/availability.ts src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx reserve/features/reservations/wizard/hooks/usePlanStepForm.ts tests/server/bookings/timeValidation.test.ts tests/reserve/service-slots.test.ts`
- `pnpm run typecheck`

## Artifacts

- Before config: `artifacts/before-old-crown-config.json`
- Before slots: `artifacts/before-old-crown-slots.json`
- After config: `artifacts/after-old-crown-config.json`
- After slots: `artifacts/after-old-crown-slots.json`
- After code alignment: `artifacts/after-code-slot-alignment.json`
- After built-in occasion cleanup: `artifacts/after-builtin-occasion-cleanup.json`

## Known Issues

- Sunday dinner still ends at `20:30` because Old Crown's configured Sunday dinner service period ends at `21:00`. This is now expected config-driven behavior.

## Sign-off

- [x] Engineering
