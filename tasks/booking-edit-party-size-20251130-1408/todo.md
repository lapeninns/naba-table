---
task: booking-edit-party-size
timestamp_utc: 2025-11-30T14:08:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify create booking party size field component and validation schema.
- [x] Locate edit booking form implementation and its validation.

## Core

- [x] Align edit form party size input UI with create form component.
- [x] Align edit form validation/payload for party size with create flow (clamp min/max).

## UI/UX

- [ ] Ensure accessibility labels and focus management match create form.

## Tests

- [ ] Update/add unit or integration tests covering party size update (if existing harness).
- [ ] Manual edit booking flow validation.

## Notes

- Assumptions: API accepts same field shape as create.
- Deviations: None yet.

## Batched Questions

- None currently.
