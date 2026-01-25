---
task: fix-ops-booking-null-times
timestamp_utc: 2026-01-25T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Ops Booking Null Times

## Objective

We will ensure ops bookings with null start/end times do not crash the dashboard by providing valid ISO strings or guarding date formatting.

## Success Criteria

- [ ] OpsBookingCard handles null start/end times without RangeError.
- [ ] startIso/endIso are always valid ISO strings or formatting is safely guarded.

## Architecture & Components

- BookingsList time normalization (source of startIso/endIso) will provide midnight fallback for null times.
- OpsBookingCard formatting remains unchanged.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No new states.

## Edge Cases

- startTime or endTime null
- startTime valid, endTime null (and vice versa)

## Testing Strategy

- Unit: add if existing tests cover BookingsList or OpsBookingCard logic
- Manual: verify dashboard renders bookings with null times

## Rollout

- No feature flag.

## DB Change Plan (if applicable)

- N/A.
