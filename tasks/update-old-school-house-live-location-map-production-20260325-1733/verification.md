---
task: update-old-school-house-live-location-map-production
timestamp_utc: 2026-03-25T17:33:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Test Outcomes

- [x] Dry-run metadata update succeeded.
- [x] Applied metadata update succeeded.
- [x] Readback confirms the destination-only map URL is stored and the review URL is unchanged.

### Production readback

- [x] `google_map_url` is now `https://www.google.com/maps/dir/?api=1&destination=The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA&travelmode=driving`
- [x] `google_review_url` remains `https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664`
- [x] Slug remains `the-old-school-house`

## Artifacts

- Update summary: `artifacts/production-live-location-map-summary.json`

## Known Issues

- [x] No known issues recorded.
