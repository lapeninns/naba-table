---
task: wizard-venue-hydration
timestamp_utc: 2025-11-28T16:13:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix venue hydration & drop default fallback

## Requirements

- Functional:
  - Wizard must hydrate venue metadata by slug via a real API endpoint that returns `VenueDetails`.
  - Hydration must not overwrite in-progress booking form edits.
  - Remove reliance on the "default" restaurant fallback in the wizard/init flows; slug or id should be explicit.
- Non-functional:
  - Preserve existing error handling/logging; no regression to booking submission.
  - Keep a11y/perf unchanged (no new UI rendering work yet).

## Existing Patterns & Reuse

- `reserve/shared/api/client.ts` for typed fetches.
- `server/restaurants/getRestaurantBySlug` already queries Supabase by slug.
- `server/restaurants/select-fields` + logo fallback helpers cover restaurant columns (address, contact, booking_policy, logo).
- Wizard state/actions live in `reserve/features/reservations/wizard/model/reducer.ts` and `useReservationWizard`.

## Constraints & Risks

- Slug must be present; removing default fallback could break callers that omit slug/id (mitigate by ensuring wizard entry points supply slug and hydration handles 404 gracefully).
- New API route should reuse existing Supabase client patterns and avoid leaking secrets.
- Need to avoid clobbering user edits when async hydration resolves.

## Open Questions (owner, due)

- Are there any entrypoints still supplying `restaurantSlug = 'default'`? Assume no; enforce explicit slug.

## Recommended Direction (with rationale)

- Add `GET /api/restaurants/[slug]` that returns `{ restaurant: VenueDetails }`, sourcing fields via Supabase (slug lookup + full details columns, with logo fallback helper).
- Update `fetchRestaurantBySlug` to hit the new route (or align path) and map response.
- In `useReservationWizard`, hydrate only venue-related fields (`id/slug/name/address/timezone`) to avoid overriding user-provided form values.
- Remove the special-case that treats slug `"default"` as null so callers must pass a real slug.
