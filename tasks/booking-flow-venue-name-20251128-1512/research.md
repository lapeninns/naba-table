---
task: booking-flow-venue-name
timestamp_utc: 2025-11-28T15:12:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Remove Default Restaurant Fallbacks

## Requirements

- **Functional**:
  - Remove `DEFAULT_RESTAURANT` constants and placeholders.
  - Ensure venue details (name, address, timezone) are fetched dynamically based on the slug.
  - Implement hydration logic to fetch venue details if missing when slug is present.
  - Ensure all entry points (Marketing, SPA, Rebook) work correctly without defaults.
- **Non-functional**:
  - Maintain existing performance.
  - Ensure no "flash of default content".

## Existing Patterns & Reuse

- `apiClient` in `reserve/features/reservations/wizard/api/` can be reused for the new fetcher.
- `useReservationWizard` hook structure will be modified.

## External Resources

- None specific.

## Constraints & Risks

- **Risk**: Breaking the booking flow if hydration fails or is too slow.
- **Risk**: Legacy code relying on defaults might break.
- **Constraint**: Must use `AGENTS.md` workflow.

## Open Questions (owner, due)

- None currently.

## Actions Taken

- Removed `DEFAULT_RESTAURANT` constants and placeholders from `reserve/shared/config/venue.ts` and `lib/venue.ts`.
- Updated `reserve/features/reservations/wizard/model/reducer.ts` to stop seeding defaults.
- Implemented `fetchRestaurantBySlug` in `reserve/features/reservations/wizard/api/`.
- Updated `useReservationWizard` to hydrate venue details using `fetchRestaurantBySlug`.
- Updated `ReservationDetailClient`, `GuestDashboardClient`, `BookingListClient`, and `page.tsx` to remove default usages.
- Added unit tests for hydration logic.

## Findings

- The application relies heavily on `DEFAULT_RESTAURANT_SLUG` for fallback, which has been removed.
- Entry points now either provide full details or rely on the new hydration mechanism.
- Manual QA was limited due to authentication barriers, but unit tests passed.
