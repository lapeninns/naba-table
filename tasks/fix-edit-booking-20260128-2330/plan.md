---
task: fix-edit-booking
timestamp_utc: 2026-01-28T23:30:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Edit Booking Button

## Objective

Restore the Edit Booking button so ops/dashboard users can open the edit flow and save changes reliably.

## Success Criteria

- [ ] Edit button opens the edit dialog/screen on dashboard and bookings views.
- [ ] Save succeeds for a valid edit and updates data.
- [ ] Manual UI QA (Chrome DevTools MCP) completed with artifacts.

## Architecture & Components

- UI: `OpsBookingCard`, `BookingsTable`, `BookingsList`, `EditBookingDialog`.
- API: booking update route/mutation handler.

## Data Flow & API Contracts

- Reuse existing booking update endpoint; no contract changes required.
- Ensure edit dialog always receives `restaurantSlug` (via `useOpsRestaurantDetails` fallback).

## UI/UX States

- Loading state for opening and saving.
- Error state if save fails (toast or inline error).

## Edge Cases

- Missing booking data.
- Unauthorized edits.
- Validation errors from API.

## Testing Strategy

- Update tests only if type/runtime regressions are introduced.
- Run lint, typecheck, and tests.

## Rollout

- No feature flag; deploy with next release.

## DB Change Plan (if applicable)

- Not applicable.

## Implementation Steps

1. Add `restaurantSlug` fallback from `useOpsRestaurantDetails` in ops bookings client and ops dashboard.
2. Thread `restaurantSlug` into `DashboardSummaryCard` → `BookingsList` booking DTO.
3. Ensure edit dialog receives slug/timezone in both flows.
4. Run validators and complete manual QA.
