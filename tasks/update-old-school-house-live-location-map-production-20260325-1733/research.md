---
task: update-old-school-house-live-location-map-production
timestamp_utc: 2026-03-25T17:33:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Update Old School House Live-Location Map Link in Production

## Requirements

- Functional:
  - Replace the customer-origin directions URL with a destination-only Google Maps directions URL so the customer's current device location can be used when available.
  - Keep the current Google review link unchanged.
- Non-functional:
  - Keep slug unchanged.
  - Use the existing guarded production metadata updater and verify the row afterward.

## Existing Patterns & Reuse

- `scripts/update-restaurant-metadata.ts` already supports guarded updates for both `google_review_url` and `google_map_url`.
- The previous Google-links task already verified the restaurant ID and current slug in production.

## External Resources

- Destination-only directions URL to store:
  - `https://www.google.com/maps/dir/?api=1&destination=The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA&travelmode=driving`

## Constraints & Risks

- Device location still depends on Google Maps and browser/app permissions at open time; this change only removes the fixed origin from the stored link.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Update only `google_map_url` to the destination-only directions link and leave `google_review_url` intact.
