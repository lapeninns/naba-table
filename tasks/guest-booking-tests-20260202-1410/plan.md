---
task: guest-booking-tests
timestamp_utc: 2026-02-02T14:10:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest booking tests

## Objective

We will add automated tests for the guest booking flow (CRUD) so that booking creation, updates, and cancellations are validated across unit, integration, E2E, and a11y layers.

## Success Criteria

- [ ] Unit tests cover key booking UI and validation helpers.
- [ ] Integration tests validate booking API handlers with mocked data access.
- [ ] E2E tests cover booking create/update/cancel flows for guest users.
- [ ] A11y checks pass on key guest booking views.

## Architecture & Components

- Guest UI: reservation wizard steps in `reserve/features/reservations/wizard/**`.
- Booking APIs: `src/app/api/bookings/**` + supporting server modules.

## Data Flow & API Contracts

- Mock Supabase interactions via server helper stubs or adapter mocks to avoid remote writes.

## UI/UX States

- Loading, validation errors, success confirmation.

## Edge Cases

- Past-time booking validation, capacity conflicts, and idempotency keys.

## Testing Strategy

- Unit: Vitest + RTL for components/helpers.
- Integration: handler tests with mocked server dependencies.
- E2E: Playwright booking CRUD.
- A11y: axe checks on booking steps + confirmation.

## Rollout

- Land tests and tooling; no runtime changes.

## DB Change Plan (if applicable)

- N/A (no DB changes).
