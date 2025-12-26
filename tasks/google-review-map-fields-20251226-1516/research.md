---
task: google-review-map-fields
timestamp_utc: 2025-12-26T15:16:12Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Separate Google Review & Map URLs

## Requirements

- Functional:
  - Add a distinct **Google Review URL** field in restaurant profile settings.
  - Keep **Google Map URL** for directions.
  - Persist both fields to `restaurants.google_review_url` and `restaurants.google_map_url`.
  - Review-request emails should use `google_review_url` first (already in email logic).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain accessible labels, hints, and error messaging.
  - Keep URL validation consistent with existing patterns.

## Existing Patterns & Reuse

- `components/ops/restaurants/RestaurantDetailsForm.tsx` already contains a Google map URL field and URL validation.
- `src/app/api/ops/restaurants/schema.ts` validates `googleMapUrl`.
- `server/restaurants/update.ts` already accepts `googleReviewUrl` (writes `google_review_url`).
- `server/emails/bookings.ts` already prioritizes `googleReviewUrl` for review CTA.

## External Resources

- None.

## Constraints & Risks

- UI changes require Chrome DevTools MCP QA artifacts.
- Ensure API schemas and DTOs include `googleReviewUrl` so profile fetch/update can round-trip.
- Supabase types may be outdated; avoid breaking type checks.

## Open Questions (owner, due)

- Owner/reviewer handles ok as `github:@maintainers`? (owner: maintainer, due: 2025-12-26)

## Recommended Direction (with rationale)

- Add `googleReviewUrl` to ops API schemas + DTOs and map it through service types.
- Update profile form to show **two** fields with clear labels and distinct helper text.
- Keep create dialog unchanged unless explicitly required, to stay within scope.
