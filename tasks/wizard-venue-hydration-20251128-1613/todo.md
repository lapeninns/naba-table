---
task: wizard-venue-hydration
timestamp_utc: 2025-11-28T16:13:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm existing wizard entry points provide real slugs (no 'default').
- [x] Identify affected tests to update.

## Core

- [x] Add `/api/restaurants/[slug]` route returning `VenueDetails` from Supabase.
- [x] Point `fetchRestaurantBySlug` to the new route and align response typing.
- [x] Update hydration merge in `useReservationWizard` to only set venue fields.
- [x] Remove the `"default"` slug special-case from wizard slug resolution.

## Tests

- [x] Update/extend hydration unit tests to cover non-overwrite behavior and slug handling.
- [x] Run unit test suite (targeted) after changes.

## Notes

- Assumptions: front-end always passes a real restaurant slug for guest flow.
- Deviations: none yet.
