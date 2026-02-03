---
task: guest-broad-coverage
timestamp_utc: 2026-02-02T18:51:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing guest E2E tests/mocks

## Core

- [x] Add reserve route coverage (root/new/slug/not-found/reservation stub) with mocked APIs
- [x] Add public bookings landing + recovery error coverage
- [x] Add mocked API coverage spec (restaurant list/detail, availability, booking lookups/history)

## Tests

- [x] Run validators (lint/typecheck/tests)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
