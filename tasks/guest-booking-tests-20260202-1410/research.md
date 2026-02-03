---
task: guest-booking-tests
timestamp_utc: 2026-02-02T14:10:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest booking tests

## Requirements

- Functional: add unit, integration, E2E, and a11y tests for guest-facing booking CRUD flow.
- Non-functional (a11y, perf, security, privacy, i18n): tests must be deterministic, avoid real Supabase writes, and validate a11y for key guest UI.

## Existing Patterns & Reuse

- Booking APIs: `src/app/api/bookings/**`, `src/app/api/ops/bookings/**`.
- Guest UI flow: `reserve/features/reservations/wizard/**`.

## External Resources

- N/A

## Constraints & Risks

- No local Supabase usage; use mocks or in-memory stubs.
- Avoid altering production booking behavior.

## Open Questions (owner, due)

- Q: Confirm preferred test runners for unit/E2E/a11y. A: Use project defaults where possible; otherwise add minimal tooling.

## Recommended Direction (with rationale)

- Add Vitest + RTL for unit/integration, Playwright for E2E, and axe-based a11y checks to cover booking CRUD across guest UI + API handlers.
