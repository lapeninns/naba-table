---
task: fix-booking-dashboard
timestamp_utc: 2026-01-03T01:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify affected components, hooks, and API/Supabase calls
- [x] Verify existing UI primitives (Shadcn) to reuse

## Core

- [x] Fix booking details dialog behavior
- [x] Fix assign table action and persistence
- [x] Fix booking card interactions
- [x] Fix cancellation flow and state refresh

## UI/UX

- [ ] Loading/empty/error states verified
- [ ] A11y roles, labels, focus management

## Tests

- [ ] Unit (run; failures in existing suites)
- [ ] Integration
- [ ] E2E
- [ ] Accessibility

## Notes

- Assumptions:
  - Cancellation in ops should call `/api/ops/bookings/{id}` and reflect in summary cache.
- Deviations:
  - Manual QA via Chrome DevTools MCP pending.

## Batched Questions

- TBD
