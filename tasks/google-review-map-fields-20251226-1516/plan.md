---
task: google-review-map-fields
timestamp_utc: 2025-12-26T15:16:12Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Separate Google Review & Map URLs

## Objective

We will enable restaurant operators to set **two distinct links**: a Google Review URL (used in review request emails) and a Google Map URL (used for directions), so post-visit emails and guest directions use the correct destination.

## Success Criteria

- [ ] Profile UI shows **both** fields with clear labels and helper text.
- [ ] Ops API accepts/returns `googleReviewUrl` and `googleMapUrl`.
- [ ] Updating profile persists both fields in `restaurants` table.

## Architecture & Components

- `components/ops/restaurants/RestaurantDetailsForm.tsx`: add `googleReviewUrl` field, validation, mapping.
- `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`: include `googleReviewUrl` in initial values + submit payload.
- `src/services/ops/restaurants.ts`: include `googleReviewUrl` in `RestaurantProfile` and mapping.
- `src/app/api/ops/restaurants/schema.ts`: add `googleReviewUrl` to create/update schemas and DTO.
- `src/app/api/ops/restaurants/[id]/route.ts`: pass through `googleReviewUrl` on PATCH and response.
- `server/restaurants/details.ts` (and/or list/get): ensure `google_review_url` is mapped in responses used by ops endpoints.

## Data Flow & API Contracts

Endpoint: `PATCH /api/ops/restaurants/:id`
Request: `{ googleReviewUrl?: string | null, googleMapUrl?: string | null, ... }`
Response: `{ restaurant: { googleReviewUrl: string | null, googleMapUrl: string | null, ... } }`
Errors: `{ error: string, details?: ... }`

## UI/UX States

- Loading: existing skeletons remain.
- Error: inline URL validation errors per field.
- Success: toast already present.

## Edge Cases

- Empty string should be stored as `null` for both URLs.
- Invalid URL should show field-specific error without blocking other fields.

## Testing Strategy

- Manual: Update profile with both URLs, verify saved and reloaded.
- A11y: focus order + labels for new field.
- Regression: ensure review email still prioritizes `googleReviewUrl`.

## Rollout

- Feature flag: none (low-risk, optional fields).
- Monitoring: none beyond normal error logs.
- Kill-switch: revert field wiring if needed.

## DB Change Plan (if applicable)

- Not applicable: migration already applied (`google_review_url` exists).
