---
task: booking-default-slug-fix
timestamp_utc: 2025-11-28T09:07:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking flow should use the active restaurant slug

## Requirements

- Functional:
  - Availability should load using the restaurant slug from the booking page (no dependency on a default slug env).
  - Review step should display the selected venue name (not the fallback “Set restaurant name”).
- Non-functional:
  - No regressions to ops walk-in flow.
  - Keep existing accessibility behaviour.

## Existing Patterns & Reuse

- Public booking page (`src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`) only passes `restaurantSlug` into `ReservationWizardClient`.
- Wizard state initializes from `DEFAULT_VENUE` (`reserve/shared/config/venue.ts`), so `restaurantName`, `restaurantTimezone`, and `restaurantId` stay on the default if not overridden.
- `ReservationWizardClient` builds `initialDetails` with just the slug, so the defaults remain and show up in Review step.
- Availability APIs already accept the slug (`/api/restaurants/[slug]/schedule`, `/calendar-mask`) and do not need the default env slug when the real slug is known.

## External Resources

- None needed; everything is in-repo.

## Constraints & Risks

- Changing props of `ReservationWizardClient` must stay compatible with existing usages (ops walk-in client still works).
- Server-side fetch should not add noticeable latency; cache headers on existing APIs can help if reused.

## Open Questions (owner, due)

- Q: Do we need the restaurant address on the review step, or is name/timezone enough? — Owner: @amankumarshrestha — Due: before QA.

## Recommended Direction (with rationale)

- Fetch restaurant metadata by slug on the booking page server component and pass id/name/slug/timezone into the wizard to override defaults. This removes reliance on `DEFAULT_RESTAURANT_SLUG` and fixes the missing venue name while keeping ops flow untouched.
