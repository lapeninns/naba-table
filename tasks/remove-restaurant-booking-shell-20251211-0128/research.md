---
task: remove-restaurant-booking-shell
timestamp_utc: 2025-12-11T01:28:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove RestaurantBookingShell component

## Requirements

- Eliminate the RestaurantBookingShell wrapper shown on `/restaurants/[slug]/book` that leaves empty space above the wizard.

## Existing Patterns & Reuse

- Booking page uses `ReservationWizardClient`; wrapper is defined in `src/components/restaurants/PublicSections.tsx` and only used in this route.

## Constraints & Risks

- Ensure wizard still rendered with sensible padding; avoid layout break for booking flow.

## Recommended Direction

- Remove shell wrapper usage in the booking page and delete the component definition to avoid unused code. Wrap wizard in a minimal container if needed.
