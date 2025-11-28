---
task: booking-flow-venue-name
timestamp_utc: 2025-11-28T15:12:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove Default Restaurant Fallbacks

## Objective

Remove hardcoded default restaurant values and ensure the booking wizard dynamically fetches/hydrates venue details based on the provided slug.

## Success Criteria

- [ ] No `DEFAULT_RESTAURANT` usage in the codebase.
- [ ] Wizard initializes with empty strings if no details provided.
- [ ] Wizard hydrates details from API if slug is present but details are missing.
- [ ] Booking flow works for:
  - Marketing page entry.
  - SPA entry.
  - Rebook flow.

## Architecture & Components

- **Config**: `reserve/shared/config/venue.ts`, `lib/venue.ts` - Update constants.
- **State**: `reserve/features/reservations/wizard/model/reducer.ts` - Remove default seeding.
- **API**: New `fetchRestaurantBySlug` in `reserve/features/reservations/wizard/api/`.
- **Hook**: `useReservationWizard` - Add hydration logic.

## Data Flow & API Contracts

- `GET /restaurants/{slug}`: Returns `{ restaurant: { id, slug, name, address, timezone, ... } }`.

## UI/UX States

- **Loading**: While hydrating, user might see a spinner or skeleton (or just wait on the first step).
- **Error**: If hydration fails, handle gracefully (maybe alert or error state).

## Edge Cases

- Slug not found -> 404 or error.
- Network failure during hydration.

## Testing Strategy

- Unit tests for reducer and hydration logic.
- Manual QA via Chrome DevTools.

## Implemented Approach

- **Config**: Removed defaults, set `DEFAULT_VENUE` to empty strings.
- **State**: Reducer initializes with empty strings.
- **Hydration**: `useReservationWizard` checks for missing details and fetches from `/restaurants/{slug}`.
- **Entrypoints**: Cleaned up default fallbacks.

## Rollout

- Direct deployment.
