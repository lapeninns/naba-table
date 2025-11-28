---
task: wizard-venue-hydration
timestamp_utc: 2025-11-28T16:13:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Venue hydration endpoint + safe merge

## Objective

Enable the reservation wizard to hydrate venue metadata by slug through a working API endpoint while preserving any in-progress user edits and eliminating the "default" restaurant fallback.

## Success Criteria

- [ ] `GET /api/restaurants/[slug]` returns `VenueDetails` for valid slugs and 404 for missing venues.
- [ ] Wizard hydration succeeds when only a slug is provided; no silent failures due to 404/HTML responses.
- [ ] Hydration updates only venue fields and never overwrites user-entered form values.
- [ ] No code path treats `restaurantSlug === 'default'` as valid fallback.
- [ ] Unit tests for hydration behavior updated/passing; manual QA planned via DevTools.

## Architecture & Components

- API route: `src/app/api/restaurants/[slug]/route.ts` using Supabase + `getRestaurantBySlug`/select-fields helpers; returns `{ restaurant: VenueDetails }`.
- Client fetcher: `reserve/features/reservations/wizard/api/fetchRestaurantBySlug.ts` targets new route and expects `{ restaurant }` payload.
- Wizard hook: `useReservationWizard` hydration effect to merge only venue-specific fields; remove `"default"` slug guard.

## Data Flow & API Contracts

- Endpoint: `GET /api/restaurants/:slug`
  - Response 200: `{ restaurant: { id, slug, name, address, phone, email, policy, timezone, logoUrl, googleMapUrl } }`
  - 404 when slug not found; 400 when slug missing/invalid; 500 on errors.

## UI/UX States

- No new UI; hydration continues silently. Errors stay logged in dev console only.

## Edge Cases

- Slug missing/empty → 400 from API; hydration effect skips fetch if slug absent.
- Fetch aborted/unmounted should be handled via `AbortController` (already in place).

## Testing Strategy

- Unit: adjust/add tests for `useReservationWizard` hydration to ensure form fields aren’t overwritten and slug "default" is not special.
- Manual QA: open wizard via `/reserve/r/:slug`, verify venue info populates without losing in-flight edits; run via Chrome DevTools MCP (to be captured in verification.md).

## Rollout

- No feature flag. Deploy directly; rely on existing logging/analytics. No DB migrations.
