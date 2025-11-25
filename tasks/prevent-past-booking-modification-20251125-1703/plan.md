---
task: prevent-past-booking-modification
timestamp_utc: 2025-11-25T17:03:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Prevent updates/deletes of past bookings

## Objective

Ensure bookings whose scheduled datetime has already passed cannot be updated or deleted through the UI or API.

## Success Criteria

- [ ] API returns a clear error when attempting to update/delete a past booking.
- [ ] UI prevents edit/delete actions for past bookings and shows guidance.
- [ ] Tests cover past, present, and future booking mutations with timezone boundary.

## Architecture & Components

- Booking API routes/handlers: enforce server-side guard before update/delete operations.
- Client booking detail page: conditionally render/disable action buttons and surface message.
- Shared date utility for “is in past” to avoid drift.

## Data Flow & API Contracts

- Endpoint(s): booking update/delete (identify concrete files during implementation).
- Errors: new error code/message like `BOOKING_IN_PAST` with user-friendly text.

## UI/UX States

- Past booking: primary actions disabled; inline note explaining past bookings are immutable.
- Future booking: unchanged behavior.
- Error toast handling on forbidden mutations.

## Edge Cases

- Booking exactly at current time boundary (use consistent timezone, likely UTC or venue tz).
- Admin override (if applicable) — default to disallow until clarified.
- Draft/pending bookings without start time.

## Testing Strategy

- Unit: date helper `isPastBooking(startTime)`.
- API/integration: attempting update/delete on past booking returns 400/403.
- UI/component: buttons disabled and message visible for past bookings; axe check unchanged.

## Rollout

- No flag initially; if risk emerges, wrap guard behind feature flag `feat.bookings.past-lock`.
- Monitor error logs for attempted mutations.

## DB Change Plan (if applicable)

- No DB schema change anticipated.
