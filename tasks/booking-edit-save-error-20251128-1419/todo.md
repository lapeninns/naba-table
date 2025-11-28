---
task: booking-edit-save-error
timestamp_utc: 2025-11-28T14:20:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate booking edit UI and API handler.
- [ ] Reproduce runtime error locally.

## Core

- [x] Identify undefined `map` source and fix data shape or guard appropriately.
- [ ] Ensure save request succeeds and response updates UI state.
- [x] Adjust inline modification idempotency key to be hold-specific to avoid P0003 mismatches.

## UI/UX

- [ ] Preserve form state on validation errors.
- [ ] Verify a11y labels/focus unchanged.

## Tests

- [ ] Add/adjust unit or integration test covering booking edit path that previously crashed.
- [ ] Run existing test suite relevant to bookings.

## Notes

- Assumptions: booking edit uses existing booking form components.
- Deviations: none yet.
