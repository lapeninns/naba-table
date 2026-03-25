---
task: update-old-school-house-google-links-production
timestamp_utc: 2026-03-25T17:22:46Z
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
- [x] Readback confirms the review URL and map URL match the user-provided values.

### Production readback

- [x] `google_review_url` matches `https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664`
- [x] `google_map_url` matches the provided customer-origin directions URL.
- [x] Slug remains `the-old-school-house`.

## Artifacts

- Update summary: `artifacts/production-google-links-summary.json`

## Known Issues

- [x] No known issues recorded.

## Sign-off

- [x] Engineering
