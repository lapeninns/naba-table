---
task: auto-assign-walkin
timestamp_utc: 2025-12-03T07:23:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Walk-in auto-assign not triggered

## Objective

Ensure ops (restaurant-facing) walk-in bookings always trigger at least one auto-assign attempt synchronously, with clear logging/telemetry, even in serverless environments where fire-and-forget jobs may be cut off.

## Success Criteria

- [ ] Auto-assign attempt logs/observability events appear for walk-in bookings in production (attempt.start / attempt.no_hold or success).
- [ ] Walk-in bookings no longer remain stuck in `pending` with only `auto_assign.started` and no attempt telemetry.
- [ ] No duplicate confirmation emails sent when the inline attempt succeeds.

## Architecture & Components

- `src/app/api/ops/bookings/route.ts`: trigger auto-assign for walk-ins.
- `server/jobs/auto-assign.ts`: allow a caller to cap attempts (new option) so we can run a bounded synchronous attempt.
  State: booking creation (ops) → inline bounded auto-assign attempt.

## Data Flow & API Contracts

Endpoint: POST /api/ops/bookings (existing)
Request: unchanged
Response: unchanged (201 + booking)
Errors: unchanged

## UI/UX States

- No UI changes; ops UI should see confirmed booking when auto-assign succeeds, or pending when it doesn’t.

## Edge Cases

- Auto-assign feature flag off → skip inline attempt (existing behaviour).
- Booking already confirmed manually before attempt → job exits early as today.
- Auto-assign attempt throws → logged, request still returns 201 with booking pending.

## Testing Strategy

- Unit: Adjust ops bookings route test to cover auto-assign invocation when flag true (mock).
- Integration/manual: Create walk-in booking locally with flag on; verify logs show attempt.start and attempt outcome.
- No UI/a11y changes required.

## Rollout

- Feature flag: `FEATURE_AUTO_ASSIGN_ON_BOOKING` (existing) controls behaviour.
- Monitoring: observability_events table for `auto_assign.*` events; console logs `[auto-assign][job]`.
- Kill-switch: disable flag to stop inline attempt scheduling.

## DB Change Plan (if applicable)

- None.
