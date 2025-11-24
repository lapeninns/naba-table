---
task: occasion-options-db
timestamp_utc: 2025-11-24T13:24:36Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Occasion options should be fetched from DB

## Objective

We will enable the occasion picker UI to source its options directly from persisted data rather than hardcoded lists so that operators can manage occasions from the database.

## Success Criteria

- [ ] Occasion options in the booking/plan step reflect data returned from the API/service layer.
- [ ] No hardcoded occasion labels remain in the UI component under test.
- [ ] Existing interactions and styling stay intact; a11y unaffected.

## Architecture & Components

- Server booking mutations (`server/bookings.ts`) should validate occasion keys against the live catalog (Supabase) instead of a hardcoded enum.
- Shared booking utilities (`lib/enums.ts`, `reserve/shared/config/booking.ts`) should permit any non-empty occasion key.
- Reusable validator helper in `server/occasions/validateBookingType.ts` to centralize DB-backed checks (cached catalog first, forced refresh fallback).

## Data Flow & API Contracts

Endpoint: `/api/restaurants/[slug]/schedule` already includes `occasionCatalog` (DB-backed).
Request: n/a (reuse existing GET).
Response: includes `occasionCatalog: OccasionDefinition[]` used by wizard UI.
Errors: validation should surface 400/500 if booking_type missing/invalid; message should reference available occasions.

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Booking type missing/blank should still error.
- Booking type present but inactive/not in catalog should fail fast with clear message.
- Cloning script should gracefully fall back to a default if catalog lookup fails.

## Testing Strategy

- Unit: adjust/extend booking validation paths (where feasible) to cover DB-backed validator.
- Manual smoke: create/update booking with a non-enumerated occasion key from DB (e.g., `christmas_party`) to ensure acceptance.
- Script: ensure clone flow still runs (logic-only review).

## Rollout

- Feature flag: n/a
- Monitoring: existing logs/QA
- Kill-switch: revert commit if needed

## DB Change Plan (if applicable)

- None (read-only path).
