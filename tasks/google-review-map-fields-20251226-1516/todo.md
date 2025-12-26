---
task: google-review-map-fields
timestamp_utc: 2025-12-26T15:16:12Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Extend profile form values to include `googleReviewUrl`
- [x] Wire ops API schema + DTO for `googleReviewUrl`

## Core

- [x] Pass `googleReviewUrl` through update route and service mapping
- [x] Map `google_review_url` in server restaurant selectors

## UI/UX

- [x] Add separate Review URL field with helper text
- [x] Keep Map URL field labeled for directions
- [x] Validate both URLs

## Tests

- [ ] Manual profile update flow
- [ ] A11y check for new field label and errors

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Owner/reviewer handles ok as `github:@maintainers`?
