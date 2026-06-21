---
task: fix-wizard-restaurant-context
timestamp_utc: 2026-04-13T16:50:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Wizard Restaurant Context

## Objective

We will keep slug-based guest booking flows restaurant-aware from the moment the wizard starts so that bookings can be submitted without relying on removed default restaurant env values.

## Success Criteria

- [ ] `buildReservationDraft()` succeeds when `restaurantSlug` is present and `restaurantId` is still blank.
- [ ] `buildReservationDraft()` still fails when both restaurant identifiers are missing.
- [ ] The wizard's slug-based venue hydration still fetches venue details whenever `restaurantId` is absent, even if name/timezone/address are already present.
- [ ] Existing id-backed booking flows continue to pass without behavior changes.

## Architecture & Components

- `reserve/features/reservations/wizard/model/transformers.ts`
  - Align the client-side draft invariant with the booking API by accepting `restaurantId` or `restaurantSlug`.
- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`
  - Treat missing `restaurantId` as an incomplete venue hydration state and continue the existing slug lookup until the id is present.
- `tests/reserve/buildReservationDraft.test.ts`
  - Add regression coverage for slug-only success and both-identifiers-missing failure.

## Data Flow & API Contracts

- Wizard state:
  - `restaurantSlug` is always known on slug-based guest flows.
  - `restaurantId` should hydrate as soon as venue details or schedule data resolve.
- Draft contract:
  - Required restaurant context: at least one of `restaurantId` or `restaurantSlug`
  - Submission payload continues sending both fields when available.
- API contract:
  - `POST /api/bookings` remains the authority for resolving the final restaurant id.

## UI/UX States

- No visible UI redesign.
- Existing "unknown restaurant" blocking error should now appear only when both restaurant identifiers are absent.

## Edge Cases

- `/r/:slug` or any slug-only embed must submit before schedule hydration completes.
- Server-rendered booking pages with full restaurant details and id must avoid redundant hydration churn.
- Timeout recovery still prefers a hydrated `restaurantId`, so the venue hydration effect should preserve that path.

## Testing Strategy

- Unit:
  - `buildReservationDraft()` with slug-only restaurant context
  - `buildReservationDraft()` with neither restaurant id nor slug
- Automated verification:
  - focused Vitest suite for draft building
  - TypeScript check for touched files

## Rollout

- No feature flag; regression fix in the canonical guest booking path.
- Monitoring:
  - watch for `"We could not determine which restaurant to book"` client errors after deploy
  - watch booking API `"RESTAURANT_REQUIRED"` responses for guest flows
- Kill-switch:
  - revert the transformer/hydration change if unexpected booking attribution issues appear.
