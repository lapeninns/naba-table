---
task: update-old-school-house-google-links-production
timestamp_utc: 2026-03-25T17:22:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Update Old School House Google Links in Production

## Objective

We will update The Old School House production record so the review link uses the user-provided Google review URL and the map link opens directions from a customer location.

## Success Criteria

- [ ] `google_review_url` matches the provided `search.google.com/local/writereview` link.
- [ ] `google_map_url` matches the provided directions URL with origin coordinates.
- [ ] Readback confirms the row was updated without changing slug or other metadata.

## Architecture & Components

- `scripts/update-restaurant-metadata.ts`: extend to include `google_map_url`.
- Task artifacts: before/after summary and verification notes.

## Data Flow & API Contracts

Target row: `public.restaurants`

Update payload:

```json
{
  "slug": "the-old-school-house",
  "google_review_url": "https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664",
  "google_map_url": "https://www.google.com/maps/dir/52.2425722,0.0814095/The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA/@52.1793596,-0.7110939,10z/data=!3m1!4b1!4m10!4m9!1m1!4e1!1m5!1m1!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!2m2!1d-0.8504611!2d52.0557627!3e0?entry=ttu&g_ep=EgoyMDI2MDMyMy4xIKXMDSoASAFQAw%3D%3D"
}
```

## UI/UX States

- Not applicable; production data change only.

## Edge Cases

- None beyond standard production guard failures.

## Testing Strategy

- Dry-run output.
- Applied output.
- Readback query for the final restaurant row.

## Rollout

- Single guarded production row update.

## DB Change Plan (if applicable)

- No schema change.
- Direct row update only.
