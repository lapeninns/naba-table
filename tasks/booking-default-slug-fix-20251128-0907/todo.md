---
task: booking-default-slug-fix
timestamp_utc: 2025-11-28T09:07:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Fetch restaurant metadata by slug on booking page; handle 404.
- [x] Pass restaurant data into ReservationWizardClient.

## Core

- [x] Build `initialDetails` with restaurant id/slug/name/timezone instead of relying on defaults.
- [x] Ensure availability queries use the provided slug (no default fallback).

## UI/UX

- [x] Review step displays the fetched venue name.

## Tests

- [ ] Smoke booking flow manually for a real slug; verify availability and review venue name.
- [ ] Run targeted unit tests if any files touched have coverage expectations.

## Notes

- Assumptions: restaurant table contains name/timezone for each slug in use.
- Deviations: None yet.

## Batched Questions

- Does marketing page need address on review? Pending (see research).
