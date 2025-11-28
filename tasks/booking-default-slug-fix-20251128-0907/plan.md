---
task: booking-default-slug-fix
timestamp_utc: 2025-11-28T09:07:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking flow should use active restaurant slug

## Objective

Ensure the guest booking wizard uses the restaurant specified in the URL (slug) for availability and review details, eliminating dependence on `DEFAULT_RESTAURANT_SLUG`.

## Success Criteria

- [ ] Availability loads for the restaurant slug in the URL without requiring any default slug env var.
- [ ] Review step shows the correct venue name from the restaurant record.
- [ ] Ops walk-in wizard continues to function (no regressions).

## Architecture & Components

- Server page `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`: fetch restaurant metadata by slug.
- Client wrapper `src/components/features/booking/wizard/ReservationWizardClient.tsx`: accept restaurant metadata and build `initialDetails` with id/slug/name/timezone.
- Wizard state (`reserve/features/reservations/wizard/...`) already consumes `initialDetails`.

## Data Flow & Contracts

- Server fetch: `getRestaurantBySlug(slug)` → returns { id, name, slug, timezone } (extend if needed).
- Pass to client as prop `restaurant`.
- Client builds `initialDetails` `{ restaurantId, restaurantSlug, restaurantName, restaurantTimezone }` fed to `ReservationWizard`.

## UI/UX States

- Loading/error already handled inside wizard; booking page should return 404 if slug not found.

## Edge Cases

- Slug not found → `notFound()` to avoid fallback to default venue.
- Missing restaurant name/timezone → use existing defaults as a last resort but prefer fetched data when present.

## Testing Strategy

- Manual: exercise booking flow on a known slug; confirm availability loads and review shows venue name.
- Unit/logic: adjust/extend props types; rely on existing wizard tests (no new heavy tests unless breakage occurs).

## Rollout

- Feature flag not needed; ship directly.

## DB Change Plan

- None.
