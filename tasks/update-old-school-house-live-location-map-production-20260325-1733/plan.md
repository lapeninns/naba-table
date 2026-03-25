---
task: update-old-school-house-live-location-map-production
timestamp_utc: 2026-03-25T17:33:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Update Old School House Live-Location Map Link in Production

## Objective

We will switch The Old School House map link back to a destination-only Google Maps directions URL so Google Maps can use the customer's current location when the link opens.

## Success Criteria

- [ ] `google_map_url` matches the destination-only directions URL.
- [ ] `google_review_url` stays as the current `search.google.com/local/writereview` link.
- [ ] Readback confirms the slug remains unchanged.

## Architecture & Components

- Reuse `scripts/update-restaurant-metadata.ts`.
- Record before/after in a task artifact.

## Data Flow & API Contracts

Update payload:

```json
{
  "slug": "the-old-school-house",
  "google_review_url": "https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664",
  "google_map_url": "https://www.google.com/maps/dir/?api=1&destination=The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA&travelmode=driving"
}
```

## UI/UX States

- Not applicable.

## Testing Strategy

- Dry-run output.
- Applied output.
- Final readback query.
