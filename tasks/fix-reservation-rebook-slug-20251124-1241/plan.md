---
task: fix-reservation-rebook-slug
timestamp_utc: 2025-11-24T12:41:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix reservation rebook slug

## Objective

Ensure rebooking from reservation detail uses the correct restaurant slug and restore successful production build.

## Success Criteria

- [ ] `pnpm run build` succeeds without TypeScript errors.
- [ ] Rebook CTA routes to `/restaurants/<slug>/book` using the reservation's restaurant when available; otherwise falls back gracefully.

## Architecture & Components

- Update reservation domain schema and adapter to carry `restaurantSlug` from Supabase `restaurants.slug`.
- Adjust reservation detail client to consume the new field with existing venue fallback.

## Data Flow & API Contracts

- Supabase query for bookings should select `restaurants(name,slug)`.
- Adapter normalizes slug into `Reservation.restaurantSlug?: string | null`.
- UI uses normalized slug for rebook link.

## UI/UX States

- No UI state changes; ensure rebook button still works when slug missing.

## Edge Cases

- Missing slug in response → fall back to venue/default slug.
- Provided venue slug overrides reservation slug if supplied.

## Testing Strategy

- Manual: run `pnpm run build` to verify type passes.
- Spot check rebook URL generation logic via code review (no runtime QA change).

## Rollout

- No flags needed; straightforward fix.

## DB Change Plan

- None.
