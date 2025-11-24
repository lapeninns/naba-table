---
task: disable-zones-tables
timestamp_utc: 2025-11-24T16:09:41Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm existing schema for zones/tables has `active` flags on zones/tables (reuse as disabled state).
- [x] Locate assignment logic (auto and manual paths).

## Core

- [x] Filter auto-assign candidates to exclude disabled zones/tables.
- [x] Validate manual assignment API to reject disabled targets with clear error.
- [x] Provide query/listing for bookings on disabled resources (or flag in UI/API response).

## UI/UX

- [x] Disable selection controls for disabled zones/tables; show reason (active now aggregates zone state and UI already blocks inactive tables).
- [ ] Ensure error surfaces are accessible.

## Tests

- [x] Unit/integration tests for filtering and rejection.
- [ ] (UI) tests if UI modified.

## Notes

- Assumptions: Flag approach acceptable; disabled resources should not be auto-reassigned.
- Deviations: None yet.

## Batched Questions

- None.
