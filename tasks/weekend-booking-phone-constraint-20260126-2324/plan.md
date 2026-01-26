---
task: weekend-booking-phone-constraint
timestamp_utc: 2026-01-26T23:24:27Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Weekend Booking Phone Constraint Fix

## Objective

We will ensure customer phone values written during booking creation always satisfy `customers_phone_check` so bookings no longer 500.

## Success Criteria

- [x] Booking creation no longer fails with Postgres code `23514` (`customers_phone_check`) for missing-phone walk-ins.
- [x] Phone fallback/contact handling is validated up front in the canonical bookings path.
- [x] Tests cover fallback phone generation and constraint-safe behavior.

## Architecture & Components

- `src/app/api/ops/bookings/route.ts`: canonical ops booking creation flow; uses `ensureFallbackContact`.
- `server/customers.ts`: `upsertCustomer` writes to `customers` table.
- `reserve/shared/validation/contact.ts`: contact validation primitives.

## Data Flow & API Contracts

- Endpoint: `POST /api/ops/bookings`
- Critical invariant: phone string length must be within DB constraint 7–20 characters.

## UI/UX States

- N/A (server-side failure; but error responses should be deterministic and safe)

## Edge Cases

- Missing phone but present email.
- Missing email but present phone.
- Neither provided (fallback logic must still be constraint-safe).
- Very long `clientRequestId` causing long fallback phone values.

## Testing Strategy

- Unit tests around fallback contact/phone generation.
- Focused tests for ops bookings helper logic.

## Rollout

- No new flags.
- Deploy normally; monitor for disappearance of `23514` errors.

## DB Change Plan (if applicable)

- None expected; this is application-level validation/fallback fix.
