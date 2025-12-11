---
task: remove-restaurant-booking-shell
timestamp_utc: 2025-12-11T01:28:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove RestaurantBookingShell

## Objective

Remove the RestaurantBookingShell wrapper and render the reservation wizard directly to eliminate the blank hero area on `/restaurants/[slug]/book`.

## Steps

- [ ] Update `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx` to render `ReservationWizardClient` without the shell; add minimal container padding if necessary.
- [ ] Delete `RestaurantBookingShell` component from `src/components/restaurants/PublicSections.tsx` and clean related imports.
- [ ] Run lint/build check.

## Testing

- [ ] `pnpm run lint --ext .ts,.tsx --max-warnings=0 src/components/landing/FactoryHomeClient.tsx src/app/dev/factory-landing/page.tsx` (limited scope acceptable).
- [ ] `pnpm run build` (already green; rerun if time).
