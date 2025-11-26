---
task: restaurant-booking-slug-fix
timestamp_utc: 2025-11-26T21:25:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Booking Wizard Missing Restaurant ID

## Requirements

- Functional: Visiting `/restaurants/:slug/book` (e.g., `white-horse-pub-waterbeach`) should allow completing a reservation without the wizard error about an unknown restaurant.
- Non-functional: Preserve existing booking UX and API contracts; avoid reintroducing reliance on default restaurant env vars.

## Existing Patterns & Reuse

- `src/app/(marketing)/restaurants/[slug]/book/page.tsx` passes `restaurantSlug` into `ReservationWizardClient`.
- Wizard state is initialized via `getInitialDetails` (defaulting to env-based `DEFAULT_RESTAURANT_ID/SLUG`).
- `buildReservationDraft` fails when `details.restaurantId` is empty, surfacing the reported error.
- Schedule data fetched via `/api/restaurants/[slug]/schedule` already includes `restaurantId` but `usePlanStepForm` never hydrates it into wizard state.

## Constraints & Risks

- Default restaurant env vars appear unset after “stop relying on default restaurants”, so state starts with an empty `restaurantId`.
- Must avoid altering booking API payload shape; only hydrate missing restaurant metadata.
- Need to ensure slug-driven flows (guest, ops) remain unaffected.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Hydrate `restaurantId` (and related venue metadata if available) from the schedule response when booking by slug so the draft has a definitive restaurant to submit, eliminating the missing-ID error without reintroducing defaults.
