---
task: default-booking-interval-30m
timestamp_utc: 2026-03-23T12:16:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Update shared reservation default interval to 30 minutes
- [x] Update server fallback/default interval paths to 30 minutes
- [x] Update new restaurant/onboarding UI defaults to 30 minutes

## Tests

- [x] Add regression coverage for the default interval
- [x] Run focused verification
