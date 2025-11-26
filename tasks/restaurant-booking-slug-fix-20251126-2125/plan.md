---
task: restaurant-booking-slug-fix
timestamp_utc: 2025-11-26T21:25:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Booking Wizard Missing Restaurant ID

## Objective

Hydrate the booking wizard with the restaurant ID (and slug metadata) when a guest books via `/restaurants/:slug/book`, removing the “could not determine which restaurant to book” error.

## Success Criteria

- [ ] `buildReservationDraft` receives a non-empty `restaurantId` when booking via slug.
- [ ] Guest booking flow submits successfully for slug-based URLs without restoring default-restaurant fallbacks.
- [ ] Existing booking schedule/time-slot behaviour remains unchanged.

## Architecture & Components

- `ReservationWizardClient` → `ReservationWizard` → `usePlanStepForm`: add hydration of restaurant metadata from schedule fetch.
- `reserve/features/reservations/wizard/services/schedule.ts` response already exposes `restaurantId` for reuse.
- Tests in `reserve/features/reservations/wizard/ui/steps/plan-step/__tests__/PlanStepForm.test.tsx` cover schedule handling and can validate hydration.

## Data Flow & API Contracts

- Input: `/restaurants/:slug/book` supplies `restaurantSlug` only.
- Fetch: `GET /api/restaurants/[slug]/schedule` returns `{ restaurantId, ... }`.
- State: update wizard `details.restaurantId` (and optionally timezone/name) once schedule loads; draft -> mutation payload remains unchanged.

## UI/UX States

- No visible UI changes; error toast should no longer appear once hydration is in place.

## Edge Cases

- Schedule fetch fails: keep current behaviour (error surfaces elsewhere); do not reintroduce defaults.
- Slug changes mid-session: hydration should follow the latest schedule response only when slug differs.

## Testing Strategy

- Add/extend unit test to assert `usePlanStepForm` (or associated hook) writes `restaurantId` from schedule into wizard state.
- Run targeted vitest suite covering plan step (or nearest available tests) to prevent regressions.

## Rollout

- No flags; immediate rollout after verification.
