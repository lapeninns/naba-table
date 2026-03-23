---
task: default-booking-interval-30m
timestamp_utc: 2026-03-23T12:16:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Change default booking interval to 30 minutes

## Requirements

- Functional:
  - Default booking interval should be 30 minutes instead of 15 minutes.
  - Existing restaurant-specific interval overrides must continue to work.
  - New restaurant creation and onboarding defaults should start at 30 minutes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the change centralized to default/fallback paths.
  - No schema changes.

## Existing Patterns & Reuse

- Shared reservation defaults live in `reserve/shared/config/reservations.ts`.
- Server schedule fallback lives in `server/restaurants/schedule.ts`.
- New restaurant defaults are also set in `server/restaurants/create.ts`, onboarding state, and restaurant settings form defaults.

## Constraints & Risks

- Must not overwrite any restaurant that already has an explicit `reservation_interval_minutes`.
- Some dev/test mocks still use 15-minute intervals intentionally and do not need to change unless they represent defaults.

## Recommended Direction (with rationale)

- Change the canonical default interval from 15 to 30 in shared config and all direct server/client fallback/default paths used when no restaurant-specific value exists.
