---
task: fix-wizard-restaurant-context
timestamp_utc: 2026-04-13T16:50:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the draft-building and hydration paths for slug-based guest booking flows.
- [x] Record the regression in task artifacts and continuity.

## Core

- [x] Align `buildReservationDraft()` with the booking API contract (`restaurantId` or `restaurantSlug`).
- [x] Keep slug-based venue hydration running until `restaurantId` is populated.

## UI/UX

- [x] Preserve the existing guest-facing error only when both restaurant identifiers are missing.

## Tests

- [x] Unit
- [x] Typecheck

## Notes

- Assumptions:
  - The booking API contract is the correct source of truth for restaurant resolution.
- Deviations:
  - Verification-first analysis was used because the failure mode was already described and tied to a live regression.

## Batched Questions

- None currently.
