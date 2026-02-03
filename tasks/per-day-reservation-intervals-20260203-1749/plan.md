---
task: per-day-reservation-intervals
timestamp_utc: 2026-02-03T17:49:04Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Per-Day Reservation Interval Overrides + Fixed Slots

## Objective

We will enable restaurant admins to set per-day reservation intervals and fixed slot times so that Friday/Saturday use 16:00/18:00/20:00 while other days use defaults.

## Success Criteria

- [ ] Ops Operating Hours can set weekly and override interval minutes and fixed slot times.
- [ ] Schedule API uses fixed slots when set; otherwise uses effective interval (override → weekly → default).
- [ ] Ops floor plan timeline uses fixed slots for the selected date; falls back to effective interval.

## Architecture & Components

- `restaurant_operating_hours` stores `reservation_interval_minutes` and `reservation_slot_times` (nullable).
- Server schedule computes effective interval per day.
- Ops settings UI exposes the interval field.

## Data Flow & API Contracts

- `PUT /api/ops/restaurants/:id/hours` accepts `reservationIntervalMinutes` and `reservationSlotTimes` in weekly/override entries.
- `GET /api/ops/restaurants/:id/hours` returns `reservationIntervalMinutes` and `reservationSlotTimes`.

## UI/UX States

- Loading/error states unchanged; interval fields show validation errors.

## Edge Cases

- Override exists without interval → fall back to weekly/default.
- Fixed slots set but outside hours/service periods → filtered out.
- Invalid interval values rejected at API boundary.

## Testing Strategy

- Manual API checks for hours and schedule endpoints.
- Manual UI validation and Ops timeline behavior for fixed slots.
- Chrome DevTools MCP QA.

## Rollout

- No feature flag; change is backwards-compatible.
